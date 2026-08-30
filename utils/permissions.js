const { PermissionsBitField } = require('discord.js');
const { getConfig } = require('./configManager');

/**
 * Checks if the user who triggered the interaction has the modRole or Administrator/ManageGuild permissions.
 * @param {import("discord.js").CommandInteraction} interaction
 * @returns {Promise<boolean>}
 */
async function checkModPermission(interaction) {
	if (!interaction.guild || !interaction.member) return false;

	const guildId = interaction.guild.id;
	const config = await getConfig();
	const modRole = config[guildId]?.roles?.modRole;
	const member = interaction.member;

	const hasAdmin =
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild);

	let hasModRole = false;
	if (modRole) {
		const modRolesArray = Array.isArray(modRole) ? modRole : [modRole];
		hasModRole = modRolesArray.some(roleId => member.roles.cache.has(roleId));
	}

	return hasAdmin || hasModRole;
}

/**
 * Checks if the user is in a voice channel and in the same voice channel as the bot (if the bot is in a voice channel).
 * @param {import("discord.js").CommandInteraction} interaction
 * @returns {{ allowed: boolean, message?: string, channel?: import("discord.js").VoiceBasedChannel }}
 */
function checkVoiceProximity(interaction) {
	const memberChannel = interaction.member?.voice?.channel;
	const botChannel = interaction.guild?.members?.me?.voice?.channel;

	if (!memberChannel) {
		return { allowed: false, message: 'You must be in a voice channel to use this command.' };
	}

	if (botChannel && botChannel.id !== memberChannel.id) {
		return { allowed: false, message: `You must be in the same voice channel (<#${botChannel.id}>) as the bot.` };
	}

	return { allowed: true, channel: memberChannel };
}

module.exports = { checkModPermission, checkVoiceProximity };
