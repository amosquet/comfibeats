const { PermissionsBitField } = require("discord.js");
const { getConfig } = require("./configManager");

/**
 * Checks if the user who triggered the interaction has the modRole or Administrator/ManageGuild permissions.
 * @param {import("discord.js").CommandInteraction} interaction
 * @returns {Promise<boolean>}
 */
async function checkModPermission(interaction) {
  if (!interaction.guild || !interaction.member) return false;

  const guildId = interaction.guild.id;
  const config = await getConfig();
  const modRoleId = config[guildId]?.roles?.modRole;
  const member = interaction.member;

  const hasAdmin =
    member.permissions.has(PermissionsBitField.Flags.Administrator) ||
    member.permissions.has(PermissionsBitField.Flags.ManageGuild);
  const hasModRole = modRoleId ? member.roles.cache.has(modRoleId) : false;

  return hasAdmin || hasModRole;
}

module.exports = { checkModPermission };
