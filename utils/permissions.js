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

module.exports = { checkModPermission };
