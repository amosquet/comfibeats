const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
const Sentry = require('@sentry/bun');
const { checkModPermission } = require('../../utils/permissions');

/**
 * Recursively locates a command file across all subdirectories in commands/
 * @param {string} commandName
 * @returns {string|null}
 */
function findCommandPath(commandName) {
	const foldersPath = path.resolve(__dirname, '..');
	try {
		const folders = fs.readdirSync(foldersPath);
		for (const folder of folders) {
			const subPath = path.join(foldersPath, folder);
			if (fs.statSync(subPath).isDirectory()) {
				const filePath = path.join(subPath, `${commandName}.js`);
				if (fs.existsSync(filePath)) {
					return filePath;
				}
			}
		}
	}
	catch (err) {
		console.error('[reload.js] Error finding command path:', err);
	}
	return null;
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('reload')
		.setDescription('Reloads a command.')
		.addStringOption((option) =>
			option
				.setName('command')
				.setDescription('The command to reload.')
				.setRequired(true),
		),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have permission to use this command.',
				ephemeral: true,
			});
		}

		const commandName = interaction.options
			.getString('command', true)
			.toLowerCase();
		const command = interaction.client.commands.get(commandName);

		if (!command) {
			return interaction.reply({
				content: `There is no command with name \`${commandName}\`!`,
				ephemeral: true,
			});
		}

		const targetPath = findCommandPath(command.data.name);
		if (!targetPath) {
			return interaction.reply({
				content: `Could not locate file for command \`${command.data.name}\`.`,
				ephemeral: true,
			});
		}

		try {
			delete require.cache[require.resolve(targetPath)];
			const newCommand = require(targetPath);

			if (!newCommand.data || !newCommand.execute) {
				throw new Error(`Command at ${targetPath} is missing a required "data" or "execute" property.`);
			}

			interaction.client.commands.set(newCommand.data.name, newCommand);
			await interaction.reply({
				content: `Command \`${newCommand.data.name}\` was reloaded!`,
				ephemeral: true,
			});
		}
		catch (error) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(error);
			}
			console.error(`[reload.js] Error while reloading command \`${command.data.name}\`:`, error);
			await interaction.reply({
				content: `❌ Failed to reload command \`${command.data.name}\`. Check server logs for details.`,
				ephemeral: true,
			});
		}
	},
};
