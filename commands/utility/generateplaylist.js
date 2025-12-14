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
				.setRequired(true))
		.addStringOption(option =>
			option.setName('folder')
				.setDescription('Optional: subfolder inside audio directory')
				.setRequired(false)),
	async execute(interaction) {
		const playlistName = interaction.options.getString('name');
		const folder = interaction.options.getString('folder');
		const audioPath = folder 
			? path.join(__dirname, '../../audio', folder)
			: path.join(__dirname, '../../audio');
		const playlistPath = path.join(__dirname, '../../playlists', `${playlistName}.json`);

		if (!fs.existsSync(audioPath)) {
			return interaction.reply('Audio folder does not exist!');
		}

		if (fs.existsSync(playlistPath)) {
			return interaction.reply(`Playlist \`${playlistName}.json\` already exists!`);
		}

		try {
			const audioFiles = [];
			const baseAudioPath = path.join(__dirname, '../../audio');

			const scanDirectory = (dir) => {
				const items = fs.readdirSync(dir, { withFileTypes: true });
				
				for (const item of items) {
					const fullPath = path.join(dir, item.name);
					
					if (item.isDirectory()) {
						scanDirectory(fullPath);
					} else if (item.isFile()) {
						const ext = path.extname(item.name).toLowerCase();
						if (['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus'].includes(ext)) {
							const relativePath = path.relative(baseAudioPath, fullPath);
							audioFiles.push(relativePath);
						}
					}
				}
			};

			scanDirectory(audioPath);

			if (audioFiles.length === 0) {
				return interaction.reply('No audio files found in the specified folder!');
			}

			fs.writeFileSync(playlistPath, JSON.stringify(audioFiles, null, 4));

			await interaction.reply(`Created playlist \`${playlistName}.json\` with ${audioFiles.length} audio files${folder ? ` from \`${folder}\`` : ''}.`);
		} catch (error) {
			console.error(error);
			await interaction.reply('There was an error generating the playlist.');
		}
	},
};
