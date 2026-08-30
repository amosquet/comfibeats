const { describe, test, expect, beforeAll, afterAll, beforeEach } = require('bun:test');
const fs = require('node:fs');
const path = require('node:path');
const { getConfig, updateConfig, saveConfig, getGuildSettings } = require('../utils/configManager');

describe('Concurrency & State Verification: AtomicConfigManager', () => {
	const configPath = path.resolve(__dirname, '../guild_settings.json');
	let originalConfigContent = null;

	beforeAll(() => {
		if (fs.existsSync(configPath)) {
			originalConfigContent = fs.readFileSync(configPath, 'utf8');
		}
	});

	afterAll(() => {
		if (originalConfigContent !== null) {
			fs.writeFileSync(configPath, originalConfigContent, 'utf8');
		}
		else if (fs.existsSync(configPath)) {
			fs.unlinkSync(configPath);
		}
	});

	beforeEach(async () => {
		// Reset config file to an empty object before each test
		await saveConfig({});
	});

	test('CONC-CRIT-01: 50 concurrent updates across distinct guilds succeed with zero lost updates', async () => {
		const CONCURRENT_COUNT = 50;
		const promises = [];

		for (let i = 1; i <= CONCURRENT_COUNT; i++) {
			const guildId = `guild_${i}`;
			promises.push(
				updateConfig((draft) => {
					draft[guildId] = {
						settings: {
							autoVC: true,
							guildIndex: i,
							defaultPlaylist: `playlist_${i}`,
						},
					};
				}),
			);
		}

		await Promise.all(promises);

		const finalConfig = await getConfig();
		expect(Object.keys(finalConfig).length).toBe(CONCURRENT_COUNT);

		for (let i = 1; i <= CONCURRENT_COUNT; i++) {
			const guildId = `guild_${i}`;
			expect(finalConfig[guildId]).toBeDefined();
			expect(finalConfig[guildId].settings.guildIndex).toBe(i);
			expect(finalConfig[guildId].settings.defaultPlaylist).toBe(`playlist_${i}`);
		}

		// Verify on-disk persistence
		const diskRaw = fs.readFileSync(configPath, 'utf8');
		const diskParsed = JSON.parse(diskRaw);
		expect(Object.keys(diskParsed).length).toBe(CONCURRENT_COUNT);
	});

	test('CONC-CRIT-01: 30 concurrent increments on a shared counter preserve strict serial consistency', async () => {
		const INCREMENT_COUNT = 30;
		const targetGuild = 'shared_counter_guild';

		await updateConfig((draft) => {
			draft[targetGuild] = { settings: { counter: 0 } };
		});

		const promises = [];
		for (let i = 0; i < INCREMENT_COUNT; i++) {
			promises.push(
				updateConfig((draft) => {
					draft[targetGuild].settings.counter = (draft[targetGuild].settings.counter || 0) + 1;
				}),
			);
		}

		await Promise.all(promises);

		const finalConfig = await getConfig();
		expect(finalConfig[targetGuild].settings.counter).toBe(INCREMENT_COUNT);
	});

	test('CONC-CRIT-01: Mutex resilience ensures failing mutators do not poison subsequent queue tasks', async () => {
		const targetGuild = 'poison_test_guild';

		// Step 1: Successful initial update
		await updateConfig((draft) => {
			draft[targetGuild] = { settings: { status: 'initial' } };
		});

		// Step 2: Failed update that throws
		let caughtError = null;
		try {
			await updateConfig(() => {
				throw new Error('Simulated mutator fatal exception');
			});
		}
		catch (err) {
			caughtError = err;
		}

		expect(caughtError).toBeDefined();
		expect(caughtError.message).toBe('Simulated mutator fatal exception');

		// Step 3: Verify draft was not committed to cache or disk
		const afterFailed = await getConfig();
		expect(afterFailed[targetGuild].settings.status).toBe('initial');

		// Step 4: Subsequent concurrent updates must execute cleanly without deadlock or error
		const nextPromises = [];
		for (let i = 1; i <= 10; i++) {
			nextPromises.push(
				updateConfig((draft) => {
					draft[targetGuild].settings[`subsequent_${i}`] = true;
				}),
			);
		}

		await Promise.all(nextPromises);

		const finalConfig = await getConfig();
		expect(finalConfig[targetGuild].settings.status).toBe('initial');
		for (let i = 1; i <= 10; i++) {
			expect(finalConfig[targetGuild].settings[`subsequent_${i}`]).toBe(true);
		}
	});

	test('CONC-HIGH-01: Temp files are atomically renamed and no orphan temp files remain', async () => {
		await updateConfig((draft) => {
			draft.atomic_test = { timestamp: Date.now() };
		});

		const dirFiles = fs.readdirSync(path.resolve(__dirname, '..'));
		const orphanTmpFiles = dirFiles.filter((f) => f.startsWith('guild_settings.json.tmp.'));
		expect(orphanTmpFiles.length).toBe(0);

		const fileContent = fs.readFileSync(configPath, 'utf8');
		expect(() => JSON.parse(fileContent)).not.toThrow();
	});

	test('getConfig() returns a deep clone that cannot mutate in-memory cache', async () => {
		await updateConfig((draft) => {
			draft.immutable_guild = { settings: { value: 'original' } };
		});

		const snapshot1 = await getConfig();
		snapshot1.immutable_guild.settings.value = 'tampered_externally';

		const snapshot2 = await getConfig();
		expect(snapshot2.immutable_guild.settings.value).toBe('original');
	});

	test('getGuildSettings() retrieves existing or initializes empty settings correctly', async () => {
		await updateConfig((draft) => {
			draft.existing_guild = { settings: { repeat: true, shuffle: false } };
		});

		const settingsExisting = await getGuildSettings('existing_guild');
		expect(settingsExisting.repeat).toBe(true);
		expect(settingsExisting.shuffle).toBe(false);

		const settingsNew = await getGuildSettings('non_existent_guild');
		expect(settingsNew).toEqual({});
	});
});
