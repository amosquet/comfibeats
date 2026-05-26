const { SlashCommandBuilder } = require('discord.js');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
    cooldown: 5,
	data: new SlashCommandBuilder().setName('pong').setDescription('Replies with Ping!'),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
		}
		await interaction.reply('Ping!');
	},
};