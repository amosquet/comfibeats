const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('leavevc')
    .setDescription('Leaves the vc the bot is currently in.'),
    async execute(interaction) {
      const connection = getVoiceConnection(interaction.guild.id);

      if (connection) {
        connection.destroy();
        await interaction.reply(`Left voice channel ${connection.joinConfig.channelId}.`);
        return;
      }

      await interaction.reply('Bot not currently in a vc.');
    }
}