const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { startMusicPlayback } = require('../music/playlist.js');
const { getConfig } = require('../../utils/configManager');
const Sentry = require('@sentry/bun');
const { checkModPermission } = require('../../utils/permissions');

const SUPPORTED_AUDIO_EXTENSIONS = [
	'.mp3',
	'.wav',
	'.flac',
	'.ogg',
	'.m4a',
	'.aac',
	'.opus',
];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('autoplay')
		.setDescription('Automatically plays the default playlist or all tracks.'),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		const guildId = interaction.guild.id;
		let playlist = [];
		let playlistName = '';

		let config = {};
		try {
			config = await getConfig();
		}
		catch (err) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(err);
			}
			console.error('[autoPlay.js] Error loading configuration:', err);
		}

		// 1. Check for default playlist in config
		if (config[guildId]?.settings?.defaultPlaylist) {
			const defaultPlaylistName = config[guildId].settings.defaultPlaylist;
			const playlistDir = path.resolve(__dirname, '../../playlists');
			const safePlaylistFile = path.basename(
				defaultPlaylistName.endsWith('.json')
					? defaultPlaylistName
					: `${defaultPlaylistName}.json`,
			);
			const playlistPath = path.resolve(playlistDir, safePlaylistFile);

			if (playlistPath.startsWith(playlistDir + path.sep) && existsSync(playlistPath)) {
				try {
					const data = await fs.readFile(playlistPath, 'utf8');
					const parsed = JSON.parse(data);
					if (Array.isArray(parsed) && parsed.length > 0) {
						playlist = parsed;
						playlistName = defaultPlaylistName;
					}
				}
				catch (err) {
					if (Sentry && typeof Sentry.captureException === 'function') {
						Sentry.captureException(err);
					}
					console.error('[autoPlay.js] Error parsing default playlist:', err);
				}
			}
		}

		// 2. If no valid default playlist found, perform recursive deep scan on audio/
		if (playlist.length === 0) {
			const audioDir = path.resolve(__dirname, '../../audio');
			if (existsSync(audioDir)) {
				try {
					const scanRecursive = async (dir) => {
						const entries = await fs.readdir(dir, { withFileTypes: true });
						const files = [];
						for (const entry of entries) {
							const fullPath = path.join(dir, entry.name);
							if (entry.isDirectory()) {
								files.push(...(await scanRecursive(fullPath)));
							}
							else if (entry.isFile()) {
								const ext = path.extname(entry.name).toLowerCase();
								if (SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
									files.push(path.relative(audioDir, fullPath));
								}
							}
						}
						return files;
					};

					playlist = await scanRecursive(audioDir);
					playlistName = 'All Tracks (Deep Scan)';
				}
				catch (err) {
					if (Sentry && typeof Sentry.captureException === 'function') {
						Sentry.captureException(err);
					}
					console.error('[autoPlay.js] Error deep scanning audio directory:', err);
				}
			}
		}

		if (playlist.length === 0) {
			return interaction.reply({
				content: 'No default playlist set and no playable audio files found in library.',
				ephemeral: true,
			});
		}

		// 3. Determine target voice channel
		let channel = interaction.member?.voice?.channel;
		if (!channel) {
			const me = interaction.guild.members.me;
			if (me?.voice?.channel) {
				channel = me.voice.channel;
			}
			else if (config[guildId]?.settings?.vcId) {
				channel = interaction.guild.channels.cache.get(
					config[guildId].settings.vcId,
				);
			}
		}

		if (!channel) {
			return interaction.reply({
				content: 'Could not determine voice channel. Please join a voice channel or set a default one.',
				ephemeral: true,
			});
		}

		const shuffleEnabled = config[guildId]?.settings?.shuffle === true;

		await interaction.reply(
			`Auto-playing: \`${playlistName}\` with ${playlist.length} songs${
				shuffleEnabled ? ' (Shuffle enabled)' : ''
			}.`,
		);

		startMusicPlayback(interaction, channel, playlist, shuffleEnabled);
	},
};
