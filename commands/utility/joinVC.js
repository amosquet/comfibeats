const { SlashCommandBuilder } = require('discord.js');

// config file
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('joinvc')
    .setDescription('Joins specified vc channel. Joins vc specified in config if none is provided.')
    .addStringOption(option =>
        option.setName('channelid')
            .setDescription('The ID of the voice channel')
            .setRequired(false)),
    async execute(interaction) {
      const channelId = interaction.options.getString('channelid');

      
    }
}