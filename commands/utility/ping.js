const { SlashCommandBuilder } = require('discord.js');
const { checkModPermission } = require('../../utils/permissions');

module.exports = {
    cooldown: 5,
	data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Ping!'),
	async execute(interaction) {
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({ content: "You do not have permission to use this command.", ephemeral: true });
		}
		await interaction.reply(`Latency is ${Date.now() - interaction.createdTimestamp}ms. API Latency is ${Math.round(interaction.client.ws.ping)}ms`);
	},
};