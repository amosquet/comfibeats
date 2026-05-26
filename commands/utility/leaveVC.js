const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('leavevc')
    .setDescription('Leaves the vc the bot is currently in.'),
    async execute(interaction) {
      if (!(await checkModPermission(interaction))) {
        return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
      }
      const connection = getVoiceConnection(interaction.guild.id);

      if (connection) {
        connection.destroy();
        await interaction.reply(`Left voice channel ${connection.joinConfig.channelId}.`);
        return;
      }

      await interaction.reply('Bot not currently in a vc.');
    }
}