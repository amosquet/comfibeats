const { SlashCommandBuilder } = require("discord.js");
const { getConfig, saveConfig } = require("../../utils/configManager");
const Sentry = require("@sentry/bun");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Toggle shuffle setting or shuffle current queue")
    .addBooleanOption((option) =>
      option
        .setName("enable")
        .setDescription("Enable or disable shuffle for the server")
        .setRequired(false),
    ),
  async execute(interaction) {
    const enable = interaction.options.getBoolean("enable");
    const guildId = interaction.guild.id;

    if (enable !== null) {
      // Toggle setting
      const config = await getConfig();

      if (!config[guildId]) {
        config[guildId] = { settings: {} };
      }
      if (!config[guildId].settings) {
        config[guildId].settings = {};
      }

      config[guildId].settings.shuffle = enable;

      try {
        await saveConfig(config);
        return interaction.reply(
          `Shuffle setting has been set to: \`${enable}\``,
        );
      } catch (e) {
        Sentry.captureException(e);
        return interaction.reply("There was an error saving the settings.");
      }
    } else {
      // Shuffle current queue
      const queue = interaction.client.musicQueue?.get(guildId);
      if (!queue || !queue.songs || queue.songs.length === 0) {
        return interaction.reply("No music queue found to shuffle.");
      }

      const currentSong = queue.songs[queue.index];
      const songsToShuffle = queue.songs.filter(
        (_, idx) => idx !== queue.index,
      );

      // Fisher-Yates shuffle
      for (let i = songsToShuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [songsToShuffle[i], songsToShuffle[j]] = [
          songsToShuffle[j],
          songsToShuffle[i],
        ];
      }

      queue.songs = [currentSong, ...songsToShuffle];
      queue.index = 0;

      return interaction.reply("🔀 Queue shuffled!");
    }
  },
};
