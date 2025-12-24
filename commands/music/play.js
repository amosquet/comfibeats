const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const path = require('node:path');
const fs = require('node:fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Plays a local audio file')
		.addStringOption(option =>
			option.setName('filename')
				.setDescription('The name of the file in the audio directory')
				.setRequired(true)),
	async execute(interaction) {
		const filename = interaction.options.getString('filename');
		const channel = interaction.member.voice.channel;

		// if (!channel) {
		// 	return interaction.reply('You need to be in a voice channel to play music!');
		// }

		const filePath = path.join(__dirname, '../../audio', filename);

		if (!fs.existsSync(filePath)) {
			return interaction.reply(`Could not find file: \`${filename}\` in the audio directory.`);
		}

		try {
			const connection = joinVoiceChannel({
				channelId: channel.id,
				guildId: interaction.guild.id,
				adapterCreator: interaction.guild.voiceAdapterCreator,
			});

			const player = createAudioPlayer();
			const resource = createAudioResource(filePath);

			player.play(resource);
			connection.subscribe(player);

			player.on(AudioPlayerStatus.Playing, () => {
				console.log('The audio player has started playing!');
			});

			player.on('error', error => {
				console.error(`Error: ${error.message}`);
			});

			await interaction.reply(`Playing: \`${filename}\``);
		} catch (error) {
			console.error(error);
			await interaction.reply('There was an error trying to play that audio.');
		}
	},
};
