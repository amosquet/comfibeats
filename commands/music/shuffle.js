const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// config file
// const config = require('../../guild_settings.json');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shuffle')
		.setDescription('Toggle shuffle setting or shuffle current queue')
		.addBooleanOption(option =>
			option.setName('enable')
				.setDescription('Enable or disable shuffle for the server')
				.setRequired(false)),
	async execute(interaction) {
		const enable = interaction.options.getBoolean('enable');
		const guildId = interaction.guild.id;
		const config = path.join(__dirname, '../../guild_settings.json');

		if (enable !== null) {
			// Toggle setting
			let settings = {};
			if (fs.existsSync(config)) {
				try {
					settings = JSON.parse(fs.readFileSync(config, 'utf8'));
				} catch (e) {
					console.error('Error reading guild settings:', e);
					return interaction.reply('There was an error reading the settings file.');
				}
			}

			if (!settings[guildId]) {
				settings[guildId] = {};
			}
			if (!settings[guildId].settings) {
				settings[guildId].settings = {};
			}

			settings[guildId].settings.shuffle = enable;

			try {
				fs.writeFileSync(config, JSON.stringify(settings, null, 4));
				return interaction.reply(`Shuffle setting has been set to: \`${enable}\``);
			} catch (e) {
				console.error('Error writing guild settings:', e);
				return interaction.reply('There was an error saving the settings.');
			}
		} else {
			// Shuffle current queue
			const queue = interaction.client.musicQueue?.get(guildId);
			if (!queue || !queue.songs || queue.songs.length === 0) {
				return interaction.reply('No music queue found to shuffle.');
			}

			const currentSong = queue.songs[queue.index];
			const songsToShuffle = queue.songs.filter((_, idx) => idx !== queue.index);

			// Fisher-Yates shuffle
			for (let i = songsToShuffle.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[songsToShuffle[i], songsToShuffle[j]] = [songsToShuffle[j], songsToShuffle[i]];
			}

			queue.songs = [currentSong, ...songsToShuffle];
			queue.index = 0;

			return interaction.reply('🔀 Queue shuffled!');
		}
	},
};

