const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const { getConfig, saveConfig } = require("../../utils/configManager");
const Sentry = require("@sentry/bun");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autojoin")
    .setDescription("Toggles auto-join for the default voice channel."),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    const config = await getConfig();

    // Ensure guild config structure exists
    if (!config[guildId]) {
      config[guildId] = {
        settings: {
          autoVC: false,
          vcId: null,
        },
      };
    }
    if (!config[guildId].settings) {
      config[guildId].settings = {};
    }

    // Toggle autoVC
    const currentAutoVC = config[guildId].settings.autoVC || false;
    const newAutoVC = !currentAutoVC;
    config[guildId].settings.autoVC = newAutoVC;

    // Save config
    try {
      await saveConfig(config);
    } catch (err) {
      Sentry.captureException(err);
      console.error("Error saving config:", err);
      return interaction.reply({
        content: "Failed to save settings.",
        ephemeral: true,
      });
    }

    let replyMessage = `Auto-join has been turned **${newAutoVC ? "ON" : "OFF"}**.`;

    // If turned ON, join the channel immediately
    if (newAutoVC) {
      const channelId = config[guildId].settings.vcId;
      if (channelId) {
        try {
          joinVoiceChannel({
            channelId: channelId,
            guildId: guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
          });
          replyMessage += ` Joining voice channel <#${channelId}>.`;
        } catch (error) {
          Sentry.captureException(error);
          console.error(error);
          replyMessage += ` Failed to join voice channel.`;
        }
      } else {
        replyMessage += ` No default voice channel set. Use \`/setvc\` to set one.`;
      }
    }

    await interaction.reply(replyMessage);
  },
};
