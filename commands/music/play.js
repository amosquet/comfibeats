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
const { existsSync } = require("node:fs");
const { getConfig } = require("../../utils/configManager");
const Sentry = require("@sentry/bun");
const { findAudioFile } = require("../../utils/fileSearch");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Plays a local audio file")
    .addStringOption((option) =>
      option
        .setName("filename")
        .setDescription("The name of the file in the audio directory")
        .setRequired(true),
    ),
  async execute(interaction) {
    const filename = interaction.options.getString("filename");
    const channel = interaction.member.voice.channel;
    const guildId = interaction.guild.id;

    if (!channel) {
      return interaction.reply(
        "You need to be in a voice channel to play music!",
      );
    }

    const filePath = findAudioFile(filename);

    if (!filePath) {
      return interaction.reply(
        `Could not find file: \`${filename}\` in the audio directory or its subfolders.`,
      );
    }

    try {
      // Stop existing player if it exists
      const existingQueue = interaction.client.musicQueue?.get(guildId);
      if (existingQueue) {
        existingQueue.player.stop();
      }

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: guildId,
        adapterCreator: interaction.guild.voiceAdapterCreator,
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
        } catch (error) {
          console.log("Voice connection lost in play.js. Attempting to reconnect...");
          const reconnect = async (attempts = 0) => {
            if (attempts >= 36) {
              console.log("Voice connection permanently lost after 3 minutes. Clearing queue.");
              player.stop();
              try { connection.destroy(); } catch(e) {}
              interaction.client.musicQueue?.delete(guildId);
              return;
            }

            try {
              console.log(`Reconnection attempt ${attempts + 1}...`);
              connection.rejoin();
              await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5000),
              ]);
              console.log("Successfully reconnected to voice channel.");
            } catch (err) {
              setTimeout(() => reconnect(attempts + 1), 5000);
            }
          };

          reconnect();
        }
      });

      const playResource = () => {
        const resource = createAudioResource(filePath);
        player.play(resource);
      };

      player.on(AudioPlayerStatus.Playing, () => {
        console.log(`The audio player started playing: ${filename}`);
      });

      player.on(AudioPlayerStatus.Idle, async () => {
        // Check repeat setting from config
        const config = await getConfig();
        if (config[guildId]?.settings?.repeat) {
          playResource();
          return;
        }

        // If not repeating, clean up queue entry for this guild
        interaction.client.musicQueue?.delete(guildId);
      });

      player.on("error", (error) => {
        Sentry.captureException(error);
        console.error(`Audio Player Error: ${error.message}`);
      });

      // Store in musicQueue so other commands can stop it
      if (!interaction.client.musicQueue) {
        interaction.client.musicQueue = new Map();
      }
      interaction.client.musicQueue.set(guildId, {
        player,
        connection,
        songs: [filename],
        index: 0,
      });

      playResource();
      await interaction.reply(`Playing: \`${filename}\``);
    } catch (error) {
      Sentry.captureException(error);
      console.error(error);
      await interaction.reply("There was an error trying to play that audio.");
    }
  },
};
