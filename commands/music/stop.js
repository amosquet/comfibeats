const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { checkVoiceProximity } = require('../../utils/permissions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('stop')
		.setDescription('Stops the music and leaves the voice channel'),
	async execute(interaction) {
		const proximity = checkVoiceProximity(interaction);
		if (!proximity.allowed) {
			return interaction.reply({ content: proximity.message, ephemeral: true });
		}

		const connection = getVoiceConnection(interaction.guild.id);
		const queue = interaction.client.musicQueue?.get(interaction.guild.id);

		if (!connection && !queue) {
			return interaction.reply({
				content: 'I am not in a voice channel!',
				ephemeral: true,
			});
		}

		// Completely destroy the queue and clear player listeners
		if (queue) {
			if (typeof queue.destroy === 'function') {
				queue.destroy();
			}
			else {
				if (queue.player) {
					queue.player.removeAllListeners();
					queue.player.stop(true);
				}
				interaction.client.musicQueue.delete(interaction.guild.id);
			}
		}

		if (connection) {
			try {
				connection.destroy();
			}
			catch (err) {
				console.error('[stop.js] Error destroying voice connection:', err);
			}
		}

		await interaction.reply('Stopped playing and left the voice channel.');
	},
};
