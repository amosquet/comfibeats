const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { getConfig } = require('../../utils/configManager');
const Sentry = require('@sentry/bun');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('joinvc')
		.setDescription(
			'Joins specified vc channel. Joins vc specified in config if none is provided.',
		)
		.addStringOption((option) =>
			option
				.setName('channelid')
				.setDescription('The ID of the voice channel')
				.setRequired(false),
		),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		let channelId = interaction.options.getString('channelid');
		if (!channelId) {
			try {
				const config = await getConfig();
				channelId = config[interaction.guild.id]?.settings?.vcId;
			}
			catch (err) {
				if (Sentry && typeof Sentry.captureException === 'function') {
					Sentry.captureException(err);
				}
				console.error('[joinVC.js] Error fetching config:', err);
			}
		}

		if (!channelId) {
			return interaction.reply({
				content: 'No channel ID provided and no default voice channel set. Use `/setvc` to set one.',
				ephemeral: true,
			});
		}

		try {
			joinVoiceChannel({
				channelId: channelId,
				guildId: interaction.guild.id,
				adapterCreator: interaction.guild.voiceAdapterCreator,
			});

			await interaction.reply(`Joining voice channel <#${channelId}>`);
		}
		catch (err) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(err);
			}
			console.error('[joinVC.js] Error joining voice channel:', err);
			await interaction.reply({
				content: `There was an error joining voice channel <#${channelId}>.`,
				ephemeral: true,
			});
		}
	},
};
