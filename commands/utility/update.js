const { SlashCommandBuilder } = require('discord.js');
const { exec } = require('child_process');
const Sentry = require('@sentry/bun');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('update')
		.setDescription('Pulls the latest changes and updates the bot (Owner only).'),
	async execute(interaction) {
		// Check if user is the application owner
		if (!interaction.client.application.owner) {
			await interaction.client.application.fetch();
		}
		const owner = interaction.client.application.owner;
		const isOwner = owner.members
			? owner.members.has(interaction.user.id)
			: owner.id === interaction.user.id;

		if (!isOwner) {
			return interaction.reply({
				content: 'You do not have permission to run this command.',
				ephemeral: true,
			});
		}

		await interaction.reply('🔄 Pulling updates and restarting...');

		// Run the update script in the background
		exec('bash ./update_comfibeats.sh', (error, stdout, stderr) => {
			if (error) {
				if (Sentry && typeof Sentry.captureException === 'function') {
					Sentry.captureException(error);
				}
				console.error(`[update.js] Error during update: ${error.message}`);
				interaction.followUp({
					content: '❌ Update failed. Check server logs for details.',
					ephemeral: true,
				}).catch(console.error);
				return;
			}
			if (stderr) {
				console.error(`[update.js] Update stderr: ${stderr}`);
			}
			console.log(`[update.js] Update stdout: ${stdout}`);
		});
	},
};
