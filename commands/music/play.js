const { SlashCommandBuilder } = require('discord.js');
const Sentry = require('@sentry/bun');
const { findAudioFile } = require('../../utils/fileSearch');
const { checkVoiceProximity } = require('../../utils/permissions');
const { GuildQueue } = require('../../structures/GuildQueue');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Plays a local audio file')
		.addStringOption((option) =>
			option
				.setName('filename')
				.setDescription('The name of the file in the audio directory')
				.setRequired(true),
		),
	async execute(interaction) {
		const proximity = checkVoiceProximity(interaction);
		if (!proximity.allowed) {
			return interaction.reply({ content: proximity.message, ephemeral: true });
		}

		const filename = interaction.options.getString('filename', true);
		const filePath = findAudioFile(filename);

		if (!filePath) {
			return interaction.reply({
				content: `Could not find file: \`${filename}\` in the audio directory or its subfolders.`,
				ephemeral: true,
			});
		}

		try {
			const guildId = interaction.guild.id;

			// Clean up existing player and listeners before starting new queue
			const existingQueue = interaction.client.musicQueue?.get(guildId);
			if (existingQueue) {
				if (typeof existingQueue.destroy === 'function') {
					existingQueue.destroy();
				}
				else if (existingQueue.player) {
					existingQueue.player.removeAllListeners();
					existingQueue.player.stop(true);
					interaction.client.musicQueue.delete(guildId);
				}
			}

			if (!interaction.client.musicQueue) {
				interaction.client.musicQueue = new Map();
			}

			const queue = new GuildQueue(
				interaction.guild,
				interaction.channel,
				proximity.channel,
			);

			interaction.client.musicQueue.set(guildId, queue);

			// Single track mode: isSingleTrack = true
			queue.setPlaylist([filename], false, true);
			await queue.play();

			await interaction.reply(`Playing: \`${filename}\``);
		}
		catch (error) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(error);
			}
			console.error('[play.js] Error executing play command:', error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'There was an error trying to play that audio.',
					ephemeral: true,
				}).catch((e) => console.error(e));
			}
			else {
				await interaction.reply({
					content: 'There was an error trying to play that audio.',
					ephemeral: true,
				}).catch((e) => console.error(e));
			}
		}
	},
};
