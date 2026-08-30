const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const Sentry = require('@sentry/bun');

const configPath = path.resolve(__dirname, '../guild_settings.json');
const tempConfigPath = path.resolve(__dirname, '../guild_settings.json.tmp');

let cachedConfig = null;
let writeQueue = Promise.resolve();

/**
 * Loads configuration directly from disk.
 * Returns {} only if file does not exist (ENOENT initial state).
 * Throws hard error on JSON syntax corruption or I/O access errors.
 */
async function loadConfigFromDisk() {
	if (!existsSync(configPath)) {
		return {};
	}
	const data = await fs.readFile(configPath, 'utf8');
	return JSON.parse(data);
}

/**
 * Returns a deep-cloned snapshot of current configuration.
 */
async function getConfig() {
	if (!cachedConfig) {
		try {
			cachedConfig = await loadConfigFromDisk();
		}
		catch (error) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(error);
			}
			console.error('Critical: Failed to read guild_settings.json:', error);
			throw new Error('Failed to load guild configuration store: ' + error.message);
		}
	}
	return JSON.parse(JSON.stringify(cachedConfig));
}

/**
 * Atomically updates guild configuration through serialized mutator functions.
 * Serializes writes using an unpoisonable promise mutex queue, modifies a draft clone
 * to prevent dirty in-memory cache desynchronization, and writes atomically via rename.
 * @param {function(Object): (void|Promise<void>)} mutatorFn
 */
async function updateConfig(mutatorFn) {
	const currentTask = (async () => {
		// Decouple from previous write failures: absorb rejections so the queue is never poisoned
		await writeQueue.catch(() => {
			// Absorb previous queue rejection
		});

		if (!cachedConfig) {
			// Do not swallow read errors with fallback {} - must throw if corrupt/unreadable
			cachedConfig = await loadConfigFromDisk();
		}

		// Deep clone draft to prevent in-memory dirty state if mutator or write fails
		const draft = JSON.parse(JSON.stringify(cachedConfig));
		await mutatorFn(draft);

		const tempFile = `${tempConfigPath}.${Date.now()}.${Math.random().toString(36).substring(2)}`;
		const payload = JSON.stringify(draft, null, 4);

		try {
			await fs.writeFile(tempFile, payload, 'utf8');
			await fs.rename(tempFile, configPath);
			// Commit in-memory cache ONLY after atomic rename succeeds on disk
			cachedConfig = draft;
		}
		catch (writeErr) {
			// Clean up orphaned temp file if write or rename failed
			try {
				await fs.unlink(tempFile);
			}
			catch {
				// Ignore temp file unlink failure
			}
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(writeErr);
			}
			console.error('Critical: Error persisting atomic configuration:', writeErr);
			throw writeErr;
		}
	})();

	writeQueue = currentTask;
	return currentTask;
}

/**
 * Legacy compatibility wrapper for saveConfig with atomic guarantee.
 */
async function saveConfig(config) {
	return updateConfig((draft) => {
		Object.keys(draft).forEach((key) => delete draft[key]);
		Object.assign(draft, config);
	});
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
	updateConfig,
	saveConfig,
	getGuildSettings,
};
