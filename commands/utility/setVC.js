const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('setvc')
    .setDescription('Sets the voice channel for the bot to use')
    .addStringOption(option =>
        option.setName('channelid')
            .setDescription('The ID of the voice channel')
            .setRequired(true)),
    async execute(interaction) {
        const channelId = interaction.options.getString('channelid');
        //Have to save the channelId to a database or configuration file
        await interaction.reply(`Voice channel set to ID: \`${channelId}\``);
    }
}