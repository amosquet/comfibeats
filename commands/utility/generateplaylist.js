const { SlashCommandBuilder } = require("discord.js");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const Sentry = require("@sentry/bun");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("generateplaylist")
    .setDescription(
      "Generates a playlist containing all audio files in the audio folder",
    )
    .addStringOption((option) =>
      option
        .setName("name")
        .setDescription("The name for the playlist file (without .json)")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("folder")
        .setDescription("Optional: subfolder inside audio directory")
        .setRequired(false),
    ),
  async execute(interaction) {
    const playlistName = interaction.options.getString("name");
    const folder = interaction.options.getString("folder");
    const audioPath = folder
      ? path.join(__dirname, "../../audio", folder)
      : path.join(__dirname, "../../audio");
    const playlistPath = path.join(
      __dirname,
      "../../playlists",
      `${playlistName}.json`,
    );

    if (!existsSync(audioPath)) {
      return interaction.reply("Audio folder does not exist!");
    }

    if (existsSync(playlistPath)) {
      return interaction.reply(
        `Playlist \`${playlistName}.json\` already exists!`,
      );
    }

    try {
      await interaction.deferReply();
      const audioFiles = [];
      const baseAudioPath = path.join(__dirname, "../../audio");

      const scanDirectory = async (dir) => {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (
              [
                ".mp3",
                ".wav",
                ".ogg",
                ".flac",
                ".m4a",
                ".aac",
                ".opus",
              ].includes(ext)
            ) {
              const relativePath = path.relative(baseAudioPath, fullPath);
              audioFiles.push(relativePath);
            }
          }
        }
      };

      await scanDirectory(audioPath);

      if (audioFiles.length === 0) {
        return interaction.editReply(
          "No audio files found in the specified folder!",
        );
      }

      await fs.writeFile(playlistPath, JSON.stringify(audioFiles, null, 4));

      await interaction.editReply(
        `Created playlist \`${playlistName}.json\` with ${audioFiles.length} audio files${folder ? ` from \`${folder}\`` : ""}.`,
      );
    } catch (error) {
      Sentry.captureException(error);
      console.error(error);
      if (interaction.deferred) {
        await interaction.editReply(
          "There was an error generating the playlist.",
        );
      } else {
        await interaction.reply("There was an error generating the playlist.");
      }
    }
  },
};
