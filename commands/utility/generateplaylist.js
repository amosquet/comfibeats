const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('generateplaylist')
		.setDescription('Generates a playlist containing all audio files in the audio folder')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name for the playlist file (without .json)')
				.setRequired(true)),
	async execute(interaction) {
		const playlistName = interaction.options.getString('name');
		const audioPath = path.join(__dirname, '../../audio');
		const playlistPath = path.join(__dirname, '../../playlists', `${playlistName}.json`);

		if (!fs.existsSync(audioPath)) {
			return interaction.reply('Audio folder does not exist!');
		}

		if (fs.existsSync(playlistPath)) {
			return interaction.reply(`Playlist \`${playlistName}.json\` already exists!`);
		}

		try {
			const files = fs.readdirSync(audioPath);
			const audioFiles = files.filter(file => {
				const ext = path.extname(file).toLowerCase();
				return ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus'].includes(ext);
			});

			if (audioFiles.length === 0) {
				return interaction.reply('No audio files found in the audio folder!');
			}

			fs.writeFileSync(playlistPath, JSON.stringify(audioFiles, null, 4));

			await interaction.reply(`Created playlist \`${playlistName}.json\` with ${audioFiles.length} audio files.`);
		} catch (error) {
			console.error(error);
			await interaction.reply('There was an error generating the playlist.');
		}
	},
};
