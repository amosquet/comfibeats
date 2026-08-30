const { Events } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const Sentry = require('@sentry/bun');

module.exports = {
	name: Events.GuildDelete,
	async execute(guild) {
		try {
			console.log(
				`[GuildDelete] Bot removed from guild ${guild.name} (${guild.id}). Cleaning up resources.`,
			);
			const queue =
				guild.client.musicQueues?.get(guild.id) ||
				guild.client.musicQueue?.get(guild.id);
			if (queue) {
				if (typeof queue.destroy === 'function') {
					queue.destroy();
				}
				else {
					if (queue.player && typeof queue.player.stop === 'function') {
						queue.player.stop(true);
					}
					if (
						queue.connection &&
						typeof queue.connection.destroy === 'function'
					) {
						try {
							queue.connection.destroy();
						}
						catch (err) {
							console.error(`[GuildDelete] Failed to destroy queue connection in guild ${guild.id}:`, err);
						}
					}
					guild.client.musicQueues?.delete(guild.id);
					guild.client.musicQueue?.delete(guild.id);
				}
			}

			const connection = getVoiceConnection(guild.id);
			if (connection) {
				try {
					connection.destroy();
				}
				catch (err) {
					console.error(`[GuildDelete] Failed to destroy voice connection in guild ${guild.id}:`, err);
				}
			}
		}
		catch (error) {
			console.error(`[GuildDelete Error] Failed cleanup for guild ${guild.id}:`, error);
			if (process.env.SENTRY_DSN) {
				Sentry.captureException(error);
			}
		}
	},
};
