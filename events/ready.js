const { Events } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		// Load config
		let config = {};
		try {
			const configPath = path.join(__dirname, '../guild_settings.json');
			if (fs.existsSync(configPath)) {
				const configFile = fs.readFileSync(configPath, 'utf8');
				config = JSON.parse(configFile);
			}
		} catch (err) {
			console.error('Error loading guild_settings.json in ready event:', err);
		}

		// Iterate over guilds in config
		for (const guildId in config) {
			const guildConfig = config[guildId];
			if (guildConfig && guildConfig.settings && guildConfig.settings.autoVC && guildConfig.settings.vcId) {
				const guild = client.guilds.cache.get(guildId);
				if (guild) {
					try {
						joinVoiceChannel({
							channelId: guildConfig.settings.vcId,
							guildId: guildId,
							adapterCreator: guild.voiceAdapterCreator
						});
						console.log(`Auto-joined voice channel ${guildConfig.settings.vcId} in guild ${guild.name} (${guildId})`);
					} catch (error) {
						console.error(`Failed to auto-join voice channel in guild ${guildId}:`, error);
					}
				}
			}
		}
	},
};