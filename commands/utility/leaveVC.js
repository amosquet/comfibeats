const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('leavevc')
		.setDescription('Leaves the vc the bot is currently in.'),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		const guildId = interaction.guild.id;

		// Clean up GuildQueue and clear musicQueue entry
		const queue = interaction.client.musicQueue?.get(guildId);
		if (queue) {
			if (typeof queue.destroy === 'function') {
				queue.destroy();
			}
			else {
				if (queue.player) {
					queue.player.removeAllListeners();
					queue.player.stop(true);
				}
				interaction.client.musicQueue.delete(guildId);
			}
		}

		const connection = getVoiceConnection(guildId);
		if (connection) {
			const channelId = connection.joinConfig.channelId;
			try {
				connection.destroy();
			}
			catch (err) {
				console.error('[leaveVC.js] Error destroying connection:', err);
			}
			await interaction.reply(`Left voice channel <#${channelId}>.`);
			return;
		}

		if (queue) {
			await interaction.reply('Cleared playback queue and stopped audio.');
			return;
		}

		await interaction.reply({
			content: 'Bot is not currently in a voice channel.',
			ephemeral: true,
		});
	},
};