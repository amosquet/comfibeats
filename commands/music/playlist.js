const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('node:path');
const fs = require('node:fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('playlist')
		.setDescription('Plays a playlist from the playlists folder')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name of the playlist file (e.g. myplaylist.json)')
				.setRequired(true)),
	async execute(interaction) {
		let playlistName = interaction.options.getString('name');
		const channel = interaction.member.voice.channel;

		if (!channel) {
			return interaction.reply('You need to be in a voice channel to play music!');
		}

		if (!playlistName.endsWith('.json')) {
			playlistName += '.json';
		}

		const playlistPath = path.join(__dirname, '../../playlists', playlistName);

		if (!fs.existsSync(playlistPath)) {
			return interaction.reply(`Could not find playlist: \`${playlistName}\` in the playlists directory.`);
		}

		let playlist;
		try {
			const data = fs.readFileSync(playlistPath, 'utf8');
			playlist = JSON.parse(data);
		} catch (error) {
			return interaction.reply(`Error parsing playlist: ${error.message}`);
		}

		if (!Array.isArray(playlist) || playlist.length === 0) {
			return interaction.reply('Playlist is empty or invalid.');
		}

		await interaction.reply(`Starting playlist: \`${playlistName}\` with ${playlist.length} songs. (Looping enabled)`);

		const connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: interaction.guild.id,
			adapterCreator: interaction.guild.voiceAdapterCreator,
		});

		const player = createAudioPlayer();
		connection.subscribe(player);

		let currentIndex = 0;

		const playNext = () => {
			if (currentIndex >= playlist.length) {
				currentIndex = 0; // Loop the playlist
			}

			const filename = playlist[currentIndex];
			const filePath = path.join(__dirname, '../../audio', filename);

			if (fs.existsSync(filePath)) {
				const resource = createAudioResource(filePath);
				player.play(resource);
			} else {
				console.log(`File not found: ${filename}, skipping.`);
				currentIndex++;
				// Avoid infinite recursion if all files are missing
				if (currentIndex < playlist.length) {
                    playNext();
                } else {
                    console.log('No valid files found in playlist.');
                    connection.destroy();
                }
				return;
			}
		};

		player.on(AudioPlayerStatus.Idle, () => {
			currentIndex++;
			playNext();
		});

		player.on('error', error => {
			console.error(`Error: ${error.message}`);
			currentIndex++;
			playNext();
		});

		playNext();
	},
};
