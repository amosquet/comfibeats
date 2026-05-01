const { SlashCommandBuilder } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const { getConfig } = require("../../utils/configManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("joinvc")
    .setDescription(
      "Joins specified vc channel. Joins vc specified in config if none is provided.",
    )
    .addStringOption((option) =>
      option
        .setName("channelid")
        .setDescription("The ID of the voice channel")
        .setRequired(false),
    ),
  async execute(interaction) {
    const config = await getConfig();
    let channelId = interaction.options.getString("channelid");
    // set channel id from config if none specified
    channelId = channelId
      ? channelId
      : config[interaction.guild.id]?.settings?.vcId;

    if (!channelId) {
      return interaction.reply(
        "No channel ID provided and no default voice channel set. Use `/setvc` to set one.",
      );
    }

    try {
      joinVoiceChannel({
        channelId: channelId,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      await interaction.reply(`Joining voice channel <#${channelId}>`);
    } catch (err) {
      console.error(`Error joining channel:`, err);
      await interaction.reply(
        `There was an error joining channel ${channelId}`,
      );
    }
  },
};
