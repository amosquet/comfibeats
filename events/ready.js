const { Events } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { getConfig } = require('../utils/configManager');
const { GuildQueue } = require('../structures/GuildQueue');
const path = require('node:path');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const Sentry = require('@sentry/bun');

module.exports = {
	name: Events.ClientReady,
	once: true,
	async execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		let config;
		try {
			config = await getConfig();
		}
		catch (err) {
			if (process.env.SENTRY_DSN) Sentry.captureException(err);
			console.error('Failed to load guild configurations on startup:', err);
			return;
		}

		if (!config || typeof config !== 'object') return;

		for (const guildId of Object.keys(config)) {
			const guildConfig = config[guildId];
			if (
				!guildConfig ||
        !guildConfig.settings ||
        !guildConfig.settings.autoVC ||
        !guildConfig.settings.vcId
			) {
				continue;
			}

			const guild = client.guilds.cache.get(guildId);
			if (!guild) continue;

			try {
				const channel = guild.channels.cache.get(guildConfig.settings.vcId);
				if (!channel || !channel.isVoiceBased()) {
					console.error(
						`Could not find valid voice channel ${guildConfig.settings.vcId} in guild ${guild.name}`,
					);
					continue;
				}

				// Clean up any stale existing queue before starting
				const existingQueue =
          client.musicQueues?.get(guildId) || client.musicQueue?.get(guildId);
				if (existingQueue) {
					if (typeof existingQueue.destroy === 'function') {
						existingQueue.destroy();
					}
					else if (existingQueue.player) {
						existingQueue.player.stop(true);
					}
				}

				const autoPlayEnabled = Boolean(guildConfig.settings.autoPlay);
				const defaultPlaylist = guildConfig.settings.defaultPlaylist;

				// If autoPlay is enabled with a default playlist, let GuildQueue manage the connection
				if (autoPlayEnabled && defaultPlaylist) {
					const safePlaylistName = path.basename(
						defaultPlaylist.endsWith('.json')
							? defaultPlaylist
							: `${defaultPlaylist}.json`,
					);
					const playlistPath = path.resolve(
						__dirname,
						'../playlists',
						safePlaylistName,
					);

					if (existsSync(playlistPath)) {
						try {
							const data = await fs.readFile(playlistPath, 'utf8');
							const songs = JSON.parse(data);

							if (Array.isArray(songs) && songs.length > 0) {
								console.log(
									`Auto-playing playlist: ${defaultPlaylist} in ${guild.name} (${channel.name})`,
								);
								const shuffleEnabled = Boolean(guildConfig.settings.shuffle);
								const queue = new GuildQueue(guild, null, channel);
								queue.setPlaylist(songs, shuffleEnabled);
								if (client.musicQueues) client.musicQueues.set(guildId, queue);
								if (client.musicQueue) client.musicQueue.set(guildId, queue);
								await queue.play();
								continue;
							}
							else {
								console.warn(
									`Auto-play playlist ${defaultPlaylist} is empty in ${guild.name}. Joining VC only.`,
								);
							}
						}
						catch (err) {
							if (process.env.SENTRY_DSN) Sentry.captureException(err);
							console.error(
								`Error reading auto-play playlist for ${guild.name}:`,
								err,
							);
						}
					}
					else {
						console.warn(
							`Auto-play failed: Playlist file ${safePlaylistName} not found. Joining VC only.`,
						);
					}
				}

				// AutoVC only: join voice channel without redundant handshakes (VOICE-MED-04)
				joinVoiceChannel({
					channelId: channel.id,
					guildId: guild.id,
					adapterCreator: guild.voiceAdapterCreator,
				});
				console.log(
					`Auto-joined voice channel ${channel.name} in guild ${guild.name} (${guildId})`,
				);
			}
			catch (error) {
				if (process.env.SENTRY_DSN) Sentry.captureException(error);
				console.error(
					`Failed to auto-join or auto-play in guild ${guildId}:`,
					error,
				);
			}
		}
	},
};
