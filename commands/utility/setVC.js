const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

// config file
const config = require('../../config.json');

console.log(config);

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
        
        // set and write channel/vc id to config
        config.vcId = channelId
        const json = JSON.stringify(config);

        try {
          fs.writeFileSync('./config.json', json);
          await interaction.reply(`Voice channel set to ID: \`${channelId}\``);
        } catch (err) {
          console.log(`error writing config :< !`, err);
        }
    }
}