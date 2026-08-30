const { SlashCommandBuilder } = require('discord.js');
const { updateConfig } = require('../../utils/configManager');
const { checkModPermission, checkVoiceProximity } = require('../../utils/permissions');
const Sentry = require('@sentry/bun');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription('Toggle shuffle setting or shuffle current queue')
		.addBooleanOption((option) =>
			option
				.setName('enable')
				.setDescription('Enable or disable shuffle for the server')
				.setRequired(false),
		),
	async execute(interaction) {
		const enable = interaction.options.getBoolean('enable');
		const guildId = interaction.guild.id;

		if (enable !== null) {
			// Modifying server configuration setting
			if (!(await checkModPermission(interaction))) {
				return interaction.reply({
					content: 'You do not have permission to modify server settings.',
					ephemeral: true,
				});
			}

			try {
				await updateConfig((draft) => {
					if (!draft[guildId]) {
						draft[guildId] = { settings: {} };
					}
					if (!draft[guildId].settings) {
						draft[guildId].settings = {};
					}
					draft[guildId].settings.shuffle = enable;
				});

				return interaction.reply(`Shuffle setting has been set to: \`${enable}\``);
			}
			catch (e) {
				if (Sentry && typeof Sentry.captureException === 'function') {
					Sentry.captureException(e);
				}
				console.error('[shuffle.js] Error saving settings:', e);
				return interaction.reply({
					content: 'There was an error saving the settings.',
					ephemeral: true,
				});
			}
		}
		else {
			// Shuffling the currently active playback queue
			const proximity = checkVoiceProximity(interaction);
			if (!proximity.allowed) {
				return interaction.reply({ content: proximity.message, ephemeral: true });
			}

			const queue = interaction.client.musicQueue?.get(guildId);
			if (!queue || !queue.songs || queue.songs.length === 0) {
				return interaction.reply({
					content: 'No music queue found to shuffle.',
					ephemeral: true,
				});
			}

			if (typeof queue.shuffle === 'function') {
				queue.shuffle();
			}
			else {
				const currentSong = queue.songs[queue.index];
				const songsToShuffle = queue.songs.filter((_, idx) => idx !== queue.index);

				for (let i = songsToShuffle.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1));
					[songsToShuffle[i], songsToShuffle[j]] = [
						songsToShuffle[j],
						songsToShuffle[i],
					];
				}

				queue.songs = [currentSong, ...songsToShuffle];
				queue.index = 0;
			}

			return interaction.reply('🔀 Queue shuffled!');
		}
	},
};
