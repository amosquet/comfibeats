const { SlashCommandBuilder } = require('discord.js');
const { getConfig, updateConfig } = require('../../utils/configManager');
const { checkModPermission } = require('../../utils/permissions');
const Sentry = require('@sentry/bun');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('settings')
		.setDescription('View or change bot settings for this server.')
		.addStringOption((option) =>
			option
				.setName('defaultplaylist')
				.setDescription('String: the default playlist to autoplay.')
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName('shuffle')
				.setDescription('boolean: whether to shuffle the playlist.')
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName('repeat')
				.setDescription('boolean: whether to repeat the playlist.')
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName('autovc')
				.setDescription('boolean: whether to automatically join vc.')
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName('autoplay')
				.setDescription(
					'boolean: whether to automatically play playlist after joining vc.',
				)
				.setRequired(false),
		)
		.addBooleanOption((option) =>
			option
				.setName('view')
				.setDescription('boolean: whether to view the current settings.')
				.setRequired(false),
		)
		.addStringOption((option) =>
			option
				.setName('vcid')
				.setDescription('String: the default voice channel ID.')
				.setRequired(false),
		),
	async execute(interaction) {
		const guildId = interaction.guild.id;

		// Check permissions if trying to change settings
		const isTryingToChange =
      interaction.options.getString('defaultplaylist') !== null ||
      interaction.options.getBoolean('shuffle') !== null ||
      interaction.options.getBoolean('repeat') !== null ||
      interaction.options.getBoolean('autovc') !== null ||
      interaction.options.getBoolean('autoplay') !== null ||
      interaction.options.getString('vcid') !== null;

		if (isTryingToChange) {
			if (!(await checkModPermission(interaction))) {
				return interaction.reply({
					content: 'You do not have permission to change bot settings. You need the designated Mod Role or Administrator permissions.',
					ephemeral: true,
				});
			}
		}

		// Get settings from interaction options
		const newSettings = {
			defaultPlaylist: interaction.options.getString('defaultplaylist'),
			shuffle: interaction.options.getBoolean('shuffle'),
			repeat: interaction.options.getBoolean('repeat'),
			autoVC: interaction.options.getBoolean('autovc'),
			autoPlay: interaction.options.getBoolean('autoplay'),
			vcId: interaction.options.getString('vcid'),
		};

		let changed = false;
		for (const value of Object.values(newSettings)) {
			if (value !== null) {
				changed = true;
				break;
			}
		}

		try {
			if (changed) {
				await updateConfig((draft) => {
					if (!draft[guildId]) {
						draft[guildId] = { settings: {} };
					}
					if (!draft[guildId].settings) {
						draft[guildId].settings = {};
					}
					for (const [key, value] of Object.entries(newSettings)) {
						if (value !== null) {
							draft[guildId].settings[key] = value;
						}
					}
				});
			}

			const config = await getConfig();
			const currentSettings = config[guildId]?.settings || {};
			const settingsJson = JSON.stringify(currentSettings, null, 2);
			const responseMessage = changed
				? `Server settings updated:\n\`\`\`json\n${settingsJson}\n\`\`\``
				: `Current server settings:\n\`\`\`json\n${settingsJson}\n\`\`\``;

			await interaction.reply(responseMessage);
		}
		catch (err) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(err);
			}
			console.error('[settings.js] Error handling settings:', err);
			await interaction.reply({
				content: 'Error handling settings.',
				ephemeral: true,
			});
		}
	},
};
