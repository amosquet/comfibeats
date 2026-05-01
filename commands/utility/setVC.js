const { SlashCommandBuilder } = require("discord.js");
const { getConfig, saveConfig } = require("../../utils/configManager");
const Sentry = require("@sentry/bun");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setvc")
    .setDescription("Sets the voice channel for the bot to use")
    .addStringOption((option) =>
      option
        .setName("channelid")
        .setDescription("The ID of the voice channel")
        .setRequired(true),
    ),
  async execute(interaction) {
    const channelId = interaction.options.getString("channelid");
    const guildId = interaction.guild.id;

    const config = await getConfig();

    if (!config[guildId]) {
      config[guildId] = { settings: {} };
    }
    if (!config[guildId].settings) {
      config[guildId].settings = {};
    }

    config[guildId].settings.vcId = channelId;

    try {
      await saveConfig(config);
      await interaction.reply(`Voice channel set to ID: \`${channelId}\``);
    } catch (err) {
      Sentry.captureException(err);
      console.error(`Error saving config:`, err);
      await interaction.reply({
        content: "Failed to save settings.",
        ephemeral: true,
      });
    }
  },
};
