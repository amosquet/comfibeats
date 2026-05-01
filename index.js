import * as Sentry from "@sentry/bun";

Sentry.init({
  dsn: "https://ee04a62911dcba3d2cfe8366d3e79fb7@o4511199473958912.ingest.us.sentry.io/4511315257393152",
  // Performance Monitoring
  tracesSampleRate: 1.0, //  Capture 100% of the transactions
});

try {
  throw new Error("Sentry Bun test");
} catch (e) {
  Sentry.captureException(e);
}

// Require the necessary discord.js classes
const fs = require("node:fs");
const path = require("node:path");
const { Client, Events, GatewayIntentBits, Collection } = require("discord.js");
const token = process.env.DISCORD_AUTH;

// Set the FFMPEG_PATH environment variable to the path of the ffmpeg binary
// This ensures that @discordjs/voice can find ffmpeg even if it's not in the system PATH
process.env.FFMPEG_PATH = require("ffmpeg-static");

// Create a new client instance
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

// Capture client errors
client.on(Events.Error, (error) => {
  Sentry.captureException(error);
});

client.commands = new Collection();
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
      );
    }
  }
}

//Reading event files - dynamically retrieving all event files in "events" folder
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Log in to Discord with your client's token
client.login(token);
