const { SlashCommandBuilder } = require("discord.js");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const { startMusicPlayback } = require("../music/playlist.js");
const { getConfig } = require("../../utils/configManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autoplay")
    .setDescription("Automatically plays the default playlist or all tracks."),
  async execute(interaction) {
    const guildId = interaction.guild.id;
    let playlist = [];
    let playlistName = "";

    const config = await getConfig();

    // 1. Check for default playlist in config
    if (config[guildId]?.settings?.defaultPlaylist) {
      const defaultPlaylistName = config[guildId].settings.defaultPlaylist;
      const playlistFile = defaultPlaylistName.endsWith(".json")
        ? defaultPlaylistName
        : defaultPlaylistName + ".json";
      const playlistPath = path.join(
        __dirname,
        "../../playlists",
        playlistFile,
      );

      if (existsSync(playlistPath)) {
        try {
          const data = await fs.readFile(playlistPath, "utf8");
          playlist = JSON.parse(data);
          playlistName = defaultPlaylistName;
        } catch (err) {
          console.error("Error parsing default playlist:", err);
        }
      }
    }

    // 2. If no playlist found, load all files from audio directory
    if (playlist.length === 0) {
      const audioPath = path.join(__dirname, "../../audio");
      if (existsSync(audioPath)) {
        try {
          const files = await fs.readdir(audioPath);
          playlist = files.filter(
            (file) =>
              !file.startsWith(".") &&
              (file.endsWith(".mp3") || file.endsWith(".wav")),
          );
          playlistName = "All Tracks";
        } catch (err) {
          console.error("Error reading audio directory:", err);
        }
      }
    }

    if (playlist.length === 0) {
      return interaction.reply(
        "No default playlist set and no audio files found.",
      );
    }

    // 3. Determine voice channel
    let channel = interaction.member.voice.channel;
    if (!channel) {
      const me = interaction.guild.members.me;
      if (me.voice.channel) {
        channel = me.voice.channel;
      } else if (config[guildId]?.settings?.vcId) {
        channel = interaction.guild.channels.cache.get(
          config[guildId].settings.vcId,
        );
      }
    }

    if (!channel) {
      return interaction.reply(
        "Could not determine voice channel. Please join a voice channel or set a default one.",
      );
    }

    await interaction.reply(
      `Auto-playing: \`${playlistName}\` with ${playlist.length} songs.`,
    );

    startMusicPlayback(interaction, channel, playlist);
  },
};
