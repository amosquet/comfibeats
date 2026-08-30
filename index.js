const Sentry = require('@sentry/bun');

// SEC-MED-02: Configure Sentry safely via process.env.SENTRY_DSN with graceful fallback
if (process.env.SENTRY_DSN) {
	Sentry.init({
		dsn: process.env.SENTRY_DSN,
		tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
	});
}

// Global unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
	if (process.env.SENTRY_DSN) {
		Sentry.captureException(reason);
	}
});

// Global uncaught exception handler
process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	if (process.env.SENTRY_DSN) {
		Sentry.captureException(error);
	}
});

// Process warning handler
process.on('warning', (warning) => {
	console.warn(`[Process Warning] ${warning.name}: ${warning.message}`);
	if (process.env.SENTRY_DSN) {
		Sentry.captureMessage(warning.message, {
			level: 'warning',
			extra: {
				name: warning.name,
				stack: warning.stack,
			},
		});
	}
});

// Require the necessary discord.js classes
const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const token = process.env.DISCORD_AUTH;

// Set the FFMPEG_PATH environment variable to the path of the ffmpeg binary
// This ensures that @discordjs/voice can find ffmpeg even if it's not in the system PATH
process.env.FFMPEG_PATH = require('ffmpeg-static');

// Create a new client instance
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Initialize global music queue collection
client.musicQueues = new Map();
client.musicQueue = client.musicQueues;

// Capture client errors
client.on(Events.Error, (error) => {
	console.error('Discord Client Error:', error);
	if (process.env.SENTRY_DSN) {
		Sentry.captureException(error);
	}
});

// Capture client warnings
client.on(Events.Warn, (info) => {
	console.warn('Discord Client Warning:', info);
	if (process.env.SENTRY_DSN) {
		Sentry.captureMessage(info, { level: 'warning' });
	}
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
if (fs.existsSync(foldersPath)) {
	const commandFolders = fs.readdirSync(foldersPath);

	for (const folder of commandFolders) {
		const commandsPath = path.join(foldersPath, folder);
		if (!fs.statSync(commandsPath).isDirectory()) continue;
		const commandFiles = fs
			.readdirSync(commandsPath)
			.filter((file) => file.endsWith('.js'));
		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			try {
				const command = require(filePath);
				if ('data' in command && 'execute' in command) {
					client.commands.set(command.data.name, command);
				}
				else {
					console.warn(
						`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
					);
				}
			}
			catch (err) {
				console.error(`Failed to load command at ${filePath}:`, err);
				if (process.env.SENTRY_DSN) Sentry.captureException(err);
			}
		}
	}
}

// Reading event files - dynamically retrieving all event files in "events" folder
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
	const eventFiles = fs
		.readdirSync(eventsPath)
		.filter((file) => file.endsWith('.js'));

	for (const file of eventFiles) {
		const filePath = path.join(eventsPath, file);
		try {
			const event = require(filePath);
			if (event.once) {
				client.once(event.name, (...args) => event.execute(...args));
			}
			else {
				client.on(event.name, (...args) => event.execute(...args));
			}
		}
		catch (err) {
			console.error(`Failed to load event at ${filePath}:`, err);
			if (process.env.SENTRY_DSN) Sentry.captureException(err);
		}
	}
}

// Log in to Discord with your client's token
if (token) {
	client.login(token);
}
else {
	console.warn('DISCORD_AUTH token is not set. Bot login skipped.');
}

module.exports = client;
