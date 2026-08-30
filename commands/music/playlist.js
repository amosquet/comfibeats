const { SlashCommandBuilder } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { getConfig } = require('../../utils/configManager');
const { checkVoiceProximity } = require('../../utils/permissions');
const { GuildQueue } = require('../../structures/GuildQueue');
const Sentry = require('@sentry/bun');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('playlist')
		.setDescription('Plays a playlist from the playlists folder')
		.addStringOption((option) =>
			option
				.setName('name')
				.setDescription('The name of the playlist file (e.g. myplaylist.json)')
				.setRequired(true),
		),
	async execute(interaction) {
		const proximity = checkVoiceProximity(interaction);
		if (!proximity.allowed) {
			return interaction.reply({ content: proximity.message, ephemeral: true });
		}

		const rawPlaylistName = interaction.options.getString('name', true);
		const playlistDir = path.resolve(__dirname, '../../playlists');
		const sanitizedName = path.basename(
			rawPlaylistName.endsWith('.json') ? rawPlaylistName : `${rawPlaylistName}.json`,
		);
		const playlistPath = path.resolve(playlistDir, sanitizedName);

		const rel = path.relative(playlistDir, playlistPath);
		if (rel.startsWith('..') || path.isAbsolute(rel)) {
			return interaction.reply({
				content: 'Invalid playlist name specified.',
				ephemeral: true,
			});
		}

		if (!existsSync(playlistPath)) {
			return interaction.reply({
				content: `Could not find playlist: \`${sanitizedName}\` in the playlists directory.`,
				ephemeral: true,
			});
		}

		let playlist;
		try {
			const data = await fs.readFile(playlistPath, 'utf8');
			playlist = JSON.parse(data);
		}
		catch (error) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(error);
			}
			console.error('[playlist.js] Error parsing playlist:', error);
			return interaction.reply({
				content: 'The requested playlist file could not be parsed.',
				ephemeral: true,
			});
		}

		if (!Array.isArray(playlist) || playlist.length === 0) {
			return interaction.reply({
				content: 'Playlist is empty or invalid.',
				ephemeral: true,
			});
		}

		// Check shuffle setting from config
		let shuffleEnabled = false;
		try {
			const config = await getConfig();
			shuffleEnabled = config[interaction.guild.id]?.settings?.shuffle === true;
		}
		catch (err) {
			console.error('[playlist.js] Error reading config for shuffle:', err);
		}

		await interaction.reply(
			`Starting playlist: \`${sanitizedName}\` with ${playlist.length} songs. (Looping enabled${
				shuffleEnabled ? ', Shuffle enabled' : ''
			})`,
		);

		startMusicPlayback(interaction, proximity.channel, playlist, shuffleEnabled);
	},
	startMusicPlayback,
};

function startMusicPlayback(
	interaction,
	channel,
	playlist,
	shuffleEnabled = false,
) {
	const guild = interaction.guild;
	const guildId = guild.id;
	const client = interaction.client;

	// Clean up existing player and listeners before starting new queue
	const existingQueue = client.musicQueue?.get(guildId);
	if (existingQueue) {
		if (typeof existingQueue.destroy === 'function') {
			existingQueue.destroy();
		}
		else if (existingQueue.player) {
			existingQueue.player.removeAllListeners();
			existingQueue.player.stop(true);
			client.musicQueue.delete(guildId);
		}
	}

	if (!client.musicQueue) {
		client.musicQueue = new Map();
	}

	const textChannel = interaction.channel || interaction.textChannel;
	const queue = new GuildQueue(guild, textChannel, channel);
	client.musicQueue.set(guildId, queue);

	queue.setPlaylist(playlist, shuffleEnabled, false);
	queue.play().catch((err) => {
		if (Sentry && typeof Sentry.captureException === 'function') {
			Sentry.captureException(err);
		}
		console.error('[playlist.js] Error in queue.play():', err);
	});
}
