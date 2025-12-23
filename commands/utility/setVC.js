const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

// config file
const config = require('../../guild_settings.json');

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
      config[interaction.guild.id].settings.vcId = channelId
      const json = JSON.stringify(config);

      try {
        fs.writeFileSync('./guild_settings.json', json);
        await interaction.reply(`Voice channel set to ID: \`${channelId}\``);
      } catch (err) {
        console.log(`error writing config :< !`, err);
      }
    }
}