const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const { getConfig, saveConfig } = require("../../utils/configManager");
const Sentry = require("@sentry/bun");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("settings")
    .setDescription("View or change bot settings for this server.")
    .addStringOption((option) =>
      option
        .setName("defaultplaylist")
        .setDescription("String: the default playlist to autoplay.")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("shuffle")
        .setDescription("boolean: whether to shuffle the playlist.")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("repeat")
        .setDescription("boolean: whether to repeat the playlist.")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("autovc")
        .setDescription("boolean: whether to automatically join vc.")
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("autoplay")
        .setDescription(
          "boolean: whether to automatically play playlist after joining vc.",
        )
        .setRequired(false),
    )
    .addBooleanOption((option) =>
      option
        .setName("view")
        .setDescription("boolean: whether to view the current settings.")
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("vcid")
        .setDescription("String: the default voice channel ID.")
        .setRequired(false),
    ),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    let config = await getConfig();

    if (!config[guildId]) {
      config[guildId] = { settings: {} };
    }
    if (!config[guildId].settings) {
      config[guildId].settings = {};
    }

    // Check permissions if trying to change settings
    const isTryingToChange =
      interaction.options.getString("defaultplaylist") !== null ||
      interaction.options.getBoolean("shuffle") !== null ||
      interaction.options.getBoolean("repeat") !== null ||
      interaction.options.getBoolean("autovc") !== null ||
      interaction.options.getBoolean("autoplay") !== null ||
      interaction.options.getString("vcid") !== null;

    if (isTryingToChange) {
      const modRole = config[guildId].roles?.modRole;
      const member = interaction.member;
      const hasAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator) || member.permissions.has(PermissionsBitField.Flags.ManageGuild);
      
      let hasModRole = false;
      if (modRole) {
        const modRolesArray = Array.isArray(modRole) ? modRole : [modRole];
        hasModRole = modRolesArray.some(roleId => member.roles.cache.has(roleId));
      }

      if (!hasAdmin && !hasModRole) {
        return interaction.reply({
          content: "You do not have permission to change bot settings. You need the designated Mod Role or Administrator permissions.",
          ephemeral: true,
        });
      }
    }

    // get settings from interaction
    const settings = {
      defaultPlaylist: interaction.options.getString("defaultplaylist"),
      shuffle: interaction.options.getBoolean("shuffle"),
      repeat: interaction.options.getBoolean("repeat"),
      autoVC: interaction.options.getBoolean("autovc"),
      autoPlay: interaction.options.getBoolean("autoplay"),
      vcId: interaction.options.getString("vcid"),
    };

    // validate and set settings
    let changed = false;
    for (const [key, value] of Object.entries(settings)) {
      if (value !== null) {
        config[guildId].settings[key] = value;
        changed = true;
      }
    }

    try {
      if (changed) {
        await saveConfig(config);
      }

      let settingsJson = JSON.stringify(config[guildId].settings, null, 2);
      let responseMessage = changed
        ? `Server settings updated:\n\`\`\`json\n${settingsJson}\n\`\`\``
        : `Current server settings:\n\`\`\`json\n${settingsJson}\n\`\`\``;

      await interaction.reply(responseMessage);
    } catch (err) {
      Sentry.captureException(err);
      await interaction.reply("Error handling settings.");
    }
  },
};
