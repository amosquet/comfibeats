const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { updateConfig } = require('../../utils/configManager');
const Sentry = require('@sentry/bun');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('autojoin')
		.setDescription('Toggles auto-join for the default voice channel.'),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		const guildId = interaction.guild.id;
		let newAutoVC = false;
		let targetChannelId = null;

		try {
			await updateConfig((draft) => {
				if (!draft[guildId]) {
					draft[guildId] = {
						settings: {
							autoVC: false,
							vcId: null,
						},
					};
				}
				if (!draft[guildId].settings) {
					draft[guildId].settings = {};
				}

				const currentAutoVC = draft[guildId].settings.autoVC || false;
				newAutoVC = !currentAutoVC;
				draft[guildId].settings.autoVC = newAutoVC;
				targetChannelId = draft[guildId].settings.vcId;
			});
		}
		catch (err) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(err);
			}
			console.error('[autoJoin.js] Error saving config:', err);
			return interaction.reply({
				content: 'Failed to save settings.',
				ephemeral: true,
			});
		}

		let replyMessage = `Auto-join has been turned **${newAutoVC ? 'ON' : 'OFF'}**.`;

		// If turned ON, join the channel immediately
		if (newAutoVC) {
			if (targetChannelId) {
				try {
					joinVoiceChannel({
						channelId: targetChannelId,
						guildId: guildId,
						adapterCreator: interaction.guild.voiceAdapterCreator,
					});
					replyMessage += ` Joining voice channel <#${targetChannelId}>.`;
				}
				catch (error) {
					if (Sentry && typeof Sentry.captureException === 'function') {
						Sentry.captureException(error);
					}
					console.error('[autoJoin.js] Failed to join voice channel:', error);
					replyMessage += ' Failed to join voice channel.';
				}
			}
			else {
				replyMessage += ' No default voice channel set. Use `/setvc` to set one.';
			}
		}

		await interaction.reply(replyMessage);
	},
};
