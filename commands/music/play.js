const { SlashCommandBuilder } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require("@discordjs/voice");
const path = require("node:path");
const { existsSync } = require("node:fs");
const { getConfig } = require("../../utils/configManager");
const Sentry = require("@sentry/bun");

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

    const filePath = path.join(__dirname, "../../audio", filename);

    if (!existsSync(filePath)) {
      return interaction.reply(
        `Could not find file: \`${filename}\` in the audio directory.`,
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
