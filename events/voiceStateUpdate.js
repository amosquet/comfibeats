const { Events } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const Sentry = require('@sentry/bun');

module.exports = {
	name: Events.VoiceStateUpdate,
	async execute(oldState, newState) {
		try {
			const client = oldState.client || newState.client;
			const botId = client.user?.id;
			if (!botId) return;

			const guildId = oldState.guild.id;

			// 1. Bot's own voice state changed
			if (oldState.id === botId) {
				// Bot disconnected or was kicked from voice channel
				if (oldState.channelId && !newState.channelId) {
					console.log(
						`[VoiceStateUpdate] Bot disconnected from VC in guild ${oldState.guild.name} (${guildId}). Cleaning up queue.`,
					);
					const queue =
						client.musicQueues?.get(guildId) ||
						client.musicQueue?.get(guildId);
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
								catch (destroyErr) {
									console.error('[VoiceStateUpdate] Error destroying connection:', destroyErr);
								}
							}
							client.musicQueues?.delete(guildId);
							client.musicQueue?.delete(guildId);
						}
					}
					const connection = getVoiceConnection(guildId);
					if (connection) {
						try {
							connection.destroy();
						}
						catch (destroyErr) {
							console.error('[VoiceStateUpdate] Error destroying orphaned connection:', destroyErr);
						}
					}
					return;
				}

				// Bot was moved to a different voice channel
				if (
					oldState.channelId &&
					newState.channelId &&
					oldState.channelId !== newState.channelId
				) {
					console.log(
						`[VoiceStateUpdate] Bot moved to voice channel ${newState.channel?.name} in guild ${newState.guild.name}.`,
					);
					const queue =
						client.musicQueues?.get(guildId) ||
						client.musicQueue?.get(guildId);
					if (queue) {
						queue.voiceChannel = newState.channel;
					}
				}
			}

			// 2. Member voice state changed: check if bot is left alone in voice channel
			const botMember = newState.guild.members.me || oldState.guild.members.me;
			const botVoiceChannel = botMember?.voice?.channel;

			if (botVoiceChannel) {
				// Count non-bot human members currently in the bot's channel
				const humanMembers = botVoiceChannel.members.filter(
					(member) => !member.user.bot,
				);

				const queue =
					client.musicQueues?.get(guildId) ||
					client.musicQueue?.get(guildId);

				if (humanMembers.size === 0) {
					// Channel is empty of human listeners -> start idle timeout
					if (queue && typeof queue.startIdleTimer === 'function') {
						queue.startIdleTimer();
					}
				}
				else if (queue && typeof queue.clearIdleTimer === 'function') {
					// Human listeners are present -> cancel idle timer
					queue.clearIdleTimer();
				}
			}
		}
		catch (error) {
			console.error('[VoiceStateUpdate Error]:', error);
			if (process.env.SENTRY_DSN) {
				Sentry.captureException(error);
			}
		}
	},
};
