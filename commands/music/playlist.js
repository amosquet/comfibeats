const { SlashCommandBuilder } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const path = require("node:path");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const { getConfig } = require("../../utils/configManager");
const Sentry = require("@sentry/bun");
const { findAudioFile } = require("../../utils/fileSearch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Plays a playlist from the playlists folder")
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The name of the playlist file (e.g. myplaylist.json)")
        .setRequired(true),
    ),
  async execute(interaction) {
    let playlistName = interaction.options.getString("name");
    let channel = interaction.member.voice.channel;
    if (!channel) {
      channel = interaction.guild.members.me.voice.channel;
    }

    if (!channel) {
      return interaction.reply(
        "You need to be in a voice channel to play music!",
      );
    }

    if (!playlistName.endsWith(".json")) {
      playlistName += ".json";
    }

    const playlistPath = path.join(__dirname, "../../playlists", playlistName);

    if (!existsSync(playlistPath)) {
      return interaction.reply(
        `Could not find playlist: \`${playlistName}\` in the playlists directory.`,
      );
    }

    let playlist;
    try {
      const data = await fs.readFile(playlistPath, "utf8");
      playlist = JSON.parse(data);
    } catch (error) {
      Sentry.captureException(error);
      return interaction.reply(`Error parsing playlist: ${error.message}`);
    }

    if (!Array.isArray(playlist) || playlist.length === 0) {
      return interaction.reply("Playlist is empty or invalid.");
    }

    // Check shuffle setting
    const config = await getConfig();
    const shuffleEnabled =
      config[interaction.guild.id]?.settings?.shuffle === true;

    await interaction.reply(
      `Starting playlist: \`${playlistName}\` with ${playlist.length} songs. (Looping enabled${
        shuffleEnabled ? ", Shuffle enabled" : ""
      })`,
    );

    startMusicPlayback(interaction, channel, playlist, shuffleEnabled);
  },
  startMusicPlayback,
};

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function startMusicPlayback(
  interaction,
  channel,
  playlist,
  shuffleEnabled = false,
) {
  if (shuffleEnabled) {
    shuffleArray(playlist);
  }

  // Stop existing player if it exists
  const existingQueue = interaction.client.musicQueue?.get(
    interaction.guild.id,
  );
  if (existingQueue) {
    existingQueue.player.stop();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: interaction.guild.id,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  connection.on("error", (error) => {
    Sentry.captureException(error);
    console.error(`Voice Connection Error: ${error.message}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
      console.log(
        "Transient network drop detected. Connection is recovering...",
      );
    } catch (error) {
      Sentry.captureException(error);
      console.log(
        "Voice connection permanently lost. Destroying connection and clearing queue.",
      );
      player.stop();
      connection.destroy();
      interaction.client.musicQueue?.delete(interaction.guild.id);
    }
  });

  if (!interaction.client.musicQueue) {
    interaction.client.musicQueue = new Map();
  }

  const queue = {
    songs: playlist,
    index: 0,
    player: player,
    connection: connection,
    shuffleEnabled: shuffleEnabled,
  };
  interaction.client.musicQueue.set(interaction.guild.id, queue);

  const playNext = async () => {
    const currentQueue = interaction.client.musicQueue.get(
      interaction.guild.id,
    );
    if (!currentQueue) return;

    if (currentQueue.index >= currentQueue.songs.length) {
      currentQueue.index = 0;
      const config = await getConfig();
      if (config[interaction.guild.id]?.settings?.shuffle) {
        shuffleArray(currentQueue.songs);
        console.log("Playlist looped and reshuffled.");
      }
    }

    const filename = currentQueue.songs[currentQueue.index];
    const filePath = findAudioFile(filename);

    if (filePath) {
      const resource = createAudioResource(filePath);
      player.play(resource);
    } else {
      console.log(`File not found: ${filename}, skipping.`);
      currentQueue.index++;
      if (currentQueue.index < currentQueue.songs.length) {
        playNext();
      } else {
        console.log("No valid files found in playlist.");
        player.stop();
        connection.destroy();
        interaction.client.musicQueue.delete(interaction.guild.id);
      }
    }
  };

  player.on(AudioPlayerStatus.Idle, () => {
    const currentQueue = interaction.client.musicQueue.get(
      interaction.guild.id,
    );
    if (currentQueue) {
      currentQueue.index++;
      playNext();
    }
  });

  player.on("error", (error) => {
    Sentry.captureException(error);
    console.error(`Audio Player Error: ${error.message}`);
    const currentQueue = interaction.client.musicQueue.get(
      interaction.guild.id,
    );
    if (currentQueue) {
      currentQueue.index++;
      playNext();
    }
  });

  playNext();
}
