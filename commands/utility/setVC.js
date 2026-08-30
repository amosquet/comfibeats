const { SlashCommandBuilder } = require('discord.js');
const { updateConfig } = require('../../utils/configManager');
const Sentry = require('@sentry/bun');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setvc')
		.setDescription('Sets the voice channel for the bot to use')
		.addStringOption((option) =>
			option
				.setName('channelid')
				.setDescription('The ID of the voice channel')
				.setRequired(true),
		),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		const channelId = interaction.options.getString('channelid', true);
		const guildId = interaction.guild.id;

		try {
			await updateConfig((draft) => {
				if (!draft[guildId]) {
					draft[guildId] = { settings: {} };
				}
				if (!draft[guildId].settings) {
					draft[guildId].settings = {};
				}
				draft[guildId].settings.vcId = channelId;
			});

			await interaction.reply(`Voice channel set to ID: \`${channelId}\``);
		}
		catch (err) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(err);
			}
			console.error('[setVC.js] Error saving config:', err);
			await interaction.reply({
				content: 'Failed to save settings.',
				ephemeral: true,
			});
		}
	},
};
