const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const Sentry = require('@sentry/bun');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('generateplaylist')
		.setDescription(
			'Generates a playlist containing all audio files in the audio folder',
		)
		.addStringOption((option) =>
			option
				.setName('name')
				.setDescription('The name for the playlist file (without .json)')
				.setRequired(true),
		)
		.addStringOption((option) =>
			option
				.setName('folder')
				.setDescription('Optional: subfolder inside audio directory')
				.setRequired(false),
		),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		const baseAudioPath = path.resolve(__dirname, '../../audio');
		const basePlaylistPath = path.resolve(__dirname, '../../playlists');

		const rawPlaylistName = interaction.options.getString('name', true);
		const rawFolder = interaction.options.getString('folder');

		const safePlaylistName = path.basename(rawPlaylistName).replace(/[^a-zA-Z0-9_-]/g, '');
		if (!safePlaylistName) {
			return interaction.reply({
				content: 'Invalid playlist name specified.',
				ephemeral: true,
			});
		}

		const playlistPath = path.resolve(basePlaylistPath, `${safePlaylistName}.json`);
		if (!playlistPath.startsWith(basePlaylistPath + path.sep)) {
			return interaction.reply({
				content: 'Invalid playlist path.',
				ephemeral: true,
			});
		}

		let audioPath = baseAudioPath;
		if (rawFolder) {
			audioPath = path.resolve(baseAudioPath, rawFolder);
			if (!audioPath.startsWith(baseAudioPath + path.sep) && audioPath !== baseAudioPath) {
				return interaction.reply({
					content: 'Invalid folder path specified.',
					ephemeral: true,
				});
			}
		}

		if (!existsSync(audioPath)) {
			return interaction.reply({
				content: 'The specified audio folder does not exist!',
				ephemeral: true,
			});
		}

		if (existsSync(playlistPath)) {
			return interaction.reply({
				content: `Playlist \`${safePlaylistName}.json\` already exists!`,
				ephemeral: true,
			});
		}

		try {
			await interaction.deferReply();
			const audioFiles = [];

			const scanDirectory = async (dir) => {
				const items = await fs.readdir(dir, { withFileTypes: true });

				for (const item of items) {
					const fullPath = path.join(dir, item.name);

					if (item.isDirectory()) {
						await scanDirectory(fullPath);
					}
					else if (item.isFile()) {
						const ext = path.extname(item.name).toLowerCase();
						if (
							[
								'.mp3',
								'.wav',
								'.ogg',
								'.flac',
								'.m4a',
								'.aac',
								'.opus',
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
					'No audio files found in the specified folder!',
				);
			}

			await fs.mkdir(basePlaylistPath, { recursive: true });

			// Atomic write using temporary file and rename
			const tempPath = `${playlistPath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
			await fs.writeFile(tempPath, JSON.stringify(audioFiles, null, 4), 'utf8');
			await fs.rename(tempPath, playlistPath);

			await interaction.editReply(
				`Created playlist \`${safePlaylistName}.json\` with ${audioFiles.length} audio files${
					rawFolder ? ` from \`${rawFolder}\`` : ''
				}.`,
			);
		}
		catch (error) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(error);
			}
			console.error('[generateplaylist.js] Error generating playlist:', error);
			if (interaction.deferred) {
				await interaction.editReply('There was an error generating the playlist.');
			}
			else {
				await interaction.reply({
					content: 'There was an error generating the playlist.',
					ephemeral: true,
				});
			}
		}
	},
};
