const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const Sentry = require("@sentry/bun");

const configPath = path.join(__dirname, "../guild_settings.json");

/**
 * Reads the guild settings from the JSON file.
 * @returns {Promise<Object>} The configuration object.
 */
async function getConfig() {
  if (!existsSync(configPath)) return {};
  try {
    const data = await fs.readFile(configPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error reading config file:", error);
    return {};
  }
}

/**
 * Saves the guild settings to the JSON file.
 * @param {Object} config The configuration object to save.
 */
async function saveConfig(config) {
  try {
    await fs.writeFile(configPath, JSON.stringify(config, null, 4));
  } catch (error) {
    Sentry.captureException(error);
    console.error("Error writing config file:", error);
    throw error;
  }
}

/**
 * Gets the settings for a specific guild.
 * @param {string} guildId
 * @returns {Promise<Object>} The guild's settings.
 */
async function getGuildSettings(guildId) {
  const config = await getConfig();
  if (!config[guildId]) {
    config[guildId] = { settings: {} };
  }
  return config[guildId].settings;
}

module.exports = {
  getConfig,
  saveConfig,
  getGuildSettings,
};
