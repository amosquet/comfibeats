const { SlashCommandBuilder } = require("discord.js");
const { getConfig, saveConfig } = require("../../utils/configManager");

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

    // get settings from interaction
    const settings = {
      defaultPlaylist: interaction.options.getString("defaultplaylist"),
      shuffle: interaction.options.getBoolean("shuffle"),
      repeat: interaction.options.getBoolean("repeat"),
      autoVC: interaction.options.getBoolean("autovc"),
      autoPlay: interaction.options.getBoolean("autoplay"),
    };

    // validate and set settings
    for (const [key, value] of Object.entries(settings)) {
      if (value !== null) {
        config[guildId].settings[key] = value;
      }
    }

    try {
      await saveConfig(config);
      let settingsJson = JSON.stringify(config[guildId].settings, null, 2);
      await interaction.reply(
        `Server settings updated:\n\`\`\`json\n${settingsJson}\n\`\`\``,
      );
    } catch (err) {
      await interaction.reply("Error saving settings.");
    }
  },
};
