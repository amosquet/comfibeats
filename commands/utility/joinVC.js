const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');

// config file
const config = require('../../guild_settings.json');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('joinvc')
    .setDescription('Joins specified vc channel. Joins vc specified in config if none is provided.')
    .addStringOption(option =>
        option.setName('channelid')
            .setDescription('The ID of the voice channel')
            .setRequired(false)),
    async execute(interaction) {
      var channelId = interaction.options.getString('channelid');      
      // set channel id from config if none specified
      channelId = channelId ? channelId : config[interaction.guild.id].settings.vcId; 

      try {
        const connection = joinVoiceChannel({
          channelId: channelId,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator
        });

        await interaction.reply(`Joining voice channel ${channelId}`);
      } catch (err) {
        console.log(`wuh oh - error D: !`, err);
        await interaction.reply(`There was an error joining channel ${channelId}`);
      }
    }
}