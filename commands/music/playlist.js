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
const fs = require("node:fs");

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

    if (!fs.existsSync(playlistPath)) {
      return interaction.reply(
        `Could not find playlist: \`${playlistName}\` in the playlists directory.`,
      );
    }

    let playlist;
    try {
      const data = fs.readFileSync(playlistPath, "utf8");
      playlist = JSON.parse(data);
    } catch (error) {
      return interaction.reply(`Error parsing playlist: ${error.message}`);
    }

    if (!Array.isArray(playlist) || playlist.length === 0) {
      return interaction.reply("Playlist is empty or invalid.");
    }

    // Check shuffle setting
    const shuffleEnabled = isShuffleEnabled(interaction.guild.id);
    if (shuffleEnabled) {
      shuffleArray(playlist);
    }

    await interaction.reply(
      `Starting playlist: \`${playlistName}\` with ${playlist.length} songs. (Looping enabled${
        shuffleEnabled ? ", Shuffle enabled" : ""
      })`,
    );

    startMusicPlayback(interaction, channel, playlist, shuffleEnabled);
  },
  startMusicPlayback,
};

function isShuffleEnabled(guildId) {
  const configPath = path.join(__dirname, "../../guild_settings.json");
  if (!fs.existsSync(configPath)) return false;
  try {
    const settings = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return settings[guildId]?.settings?.shuffle === true;
  } catch (e) {
    console.error("Error reading settings for shuffle check:", e);
    return false;
  }
}

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
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: interaction.guild.id,
    adapterCreator: interaction.guild.voiceAdapterCreator,
  });

  const player = createAudioPlayer();
  connection.subscribe(player);

  connection.on("error", (error) => {
    console.error("Voice Connection Error: ${error.message}");
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      // Give the connection 5000 milliseconds (5s) to automatically begin recovering
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);

      console.log(
        "Transient network drop detected. Connection is recovering...",
      );
      // The bot is successfully reconnecting, so we do nothing and let it recover.
    } catch (error) {
      // The timeout expired without entering a recovery state. It's a true disconnect.
      console.log(
        "Voice connection permanently lost. Destroying connection and clearing queue.",
      );
      player.stop();
      connection.destroy();
      interaction.client.musicQueue.delete(interaction.guild.id);
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
    shuffleEnabled: shuffleEnabled, // Store the setting in the queue
  };
  interaction.client.musicQueue.set(interaction.guild.id, queue);

  const playNext = () => {
    const currentQueue = interaction.client.musicQueue.get(
      interaction.guild.id,
    );
    if (!currentQueue) return;

    if (currentQueue.index >= currentQueue.songs.length) {
      currentQueue.index = 0; // Loop the playlist

      // Re-shuffle if enabled when looping
      // We check the file again in case settings changed, or rely on the initial passed value?
      // Based on request "If shuffle is set to true... each time it reaches the end... it should shuffle"
      // It's safer to check the queue property we set, but let's re-check the file to be dynamic if the user toggled it mid-playlist.
      const currentShuffleState = isShuffleEnabled(interaction.guild.id);
      if (currentShuffleState) {
        shuffleArray(currentQueue.songs);
        console.log("Playlist looped and reshuffled.");
      }
    }

    const filename = currentQueue.songs[currentQueue.index];
    const filePath = path.join(__dirname, "../../audio", filename);

    if (fs.existsSync(filePath)) {
      const resource = createAudioResource(filePath);
      player.play(resource);
    } else {
      console.log(`File not found: ${filename}, skipping.`);
      currentQueue.index++;
      // Avoid infinite recursion if all files are missing
      if (currentQueue.index < currentQueue.songs.length) {
        playNext();
      } else {
        console.log("No valid files found in playlist.");
        connection.destroy();
        interaction.client.musicQueue.delete(interaction.guild.id);
      }
      return;
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
    console.error(`Error: ${error.message}`);
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
