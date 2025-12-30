const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

// config file
const config = require('../../guild_settings.json');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('View or change bot settings for this server.')
    .addStringOption(option =>
      option.setName('defaultplaylist')
        .setDescription('String: the default playlist to autoplay.')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('shuffle')
        .setDescription('boolean: whether to shuffle the playlist.')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('repeat')
        .setDescription('boolean: whether to repeat the playlist.')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('autovc')
        .setDescription('boolean: whether to automatically join vc.')
        .setRequired(false))
    .addBooleanOption(option =>
      option.setName('autoplay')
        .setDescription('boolean: whether to automatically play playlist after joining vc.')
        .setRequired(false)),
    async execute(interaction) {
      const guildId = interaction.guild.id;

      // get settings from interaction
      const settings = {};
      settings.defaultPlaylist = interaction.options.getString('defaultplaylist');
      settings.shuffle = interaction.options.getBoolean('shuffle');
      settings.repeat = interaction.options.getBoolean('repeat');
      settings.autoVC = interaction.options.getBoolean('autovc');
      settings.autoPlay = interaction.options.getBoolean('autoplay');

      // validate and set settings
      Object.keys(settings).forEach(async (setting) => {
        if (settings[setting] !== null) { // skip settings not set by user
          const [ optionSet, err ] = setOption(config, guildId, setting, settings[setting]);
          if (!optionSet) { // error with setting
            await interaction.reply(err)
            return;
          }
        }
      });

      // save settings
      const json = JSON.stringify(config);

      // format to look nicer in disc md
      let settingsJson = JSON.stringify(config[guildId].settings);
      settingsJson = settingsJson.replaceAll(',"', ',\n  "').replaceAll('{"', '{\n  "').replaceAll('"}', '"\n}').replaceAll(':', ': '); 
      try {
        fs.writeFileSync('./guild_settings.json', json);
        await interaction.reply(`server settings: \`\`\`json\n${settingsJson}\`\`\``);
      } catch (err) {
        console.log(`error writing config :< !`, err);
      }
    }
}

/**
 * sets the provided setting key to the provided value
 * 
 * @param {Object} config the config object from guild_settings.json
 * @param {String} guildId the guild id of the server whose settings are being changed
 * @param {String} key the key of the value to set 
 * @param {*} value the value to set 
 * 
 * @returns whether the option was set successfully, and an error message if it was not
 */
function setOption(config, guildId, key, value) {
  switch (key) { // validate user input
    case "defaultPlaylist":
      break;
    case "shuffle":
      if (typeof value !== 'boolean')
        return [false, "'shuffle' must be a boolean"]
      break;
    case "repeat":
      if (typeof value !== 'boolean')
        return [false, "'repeat' must be a boolean"]
      break;
    case "autoVC":
      if (typeof value !== 'boolean')
        return [false, "'autovc' must be a boolean"]
      break;
    case "autoPlay":
      if (typeof value !== 'boolean')
        return [false, "'autoplay' must be a boolean"]
    default:
      throw new Error(`unrecognized setting ${key}`);
  }

  config[guildId].settings[key] = value;
  return [true];
}