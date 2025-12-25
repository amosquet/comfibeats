const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { startMusicPlayback } = require('../music/playlist.js');

// Try to require config
let config;
try {
    config = require('../../guild_settings.json');
} catch (err) {
    config = {};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Automatically plays the default playlist or all tracks.'),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        let playlist = [];
        let playlistName = '';

        // 1. Check for default playlist in config
        if (config[guildId] && config[guildId].settings && config[guildId].settings.defaultPlaylist) {
            const defaultPlaylistName = config[guildId].settings.defaultPlaylist;
            const playlistPath = path.join(__dirname, '../../playlists', defaultPlaylistName.endsWith('.json') ? defaultPlaylistName : defaultPlaylistName + '.json');
            
            if (fs.existsSync(playlistPath)) {
                try {
                    const data = fs.readFileSync(playlistPath, 'utf8');
                    playlist = JSON.parse(data);
                    playlistName = defaultPlaylistName;
                } catch (err) {
                    console.error('Error parsing default playlist:', err);
                }
            }
        }

        // 2. If no playlist found, load all files from audio directory
        if (playlist.length === 0) {
            const audioPath = path.join(__dirname, '../../audio');
            if (fs.existsSync(audioPath)) {
                const files = fs.readdirSync(audioPath).filter(file => !file.startsWith('.')); // Ignore hidden files
                playlist = files;
                playlistName = 'All Tracks';
            }
        }

        if (playlist.length === 0) {
            return interaction.reply('No default playlist set and no audio files found.');
        }

        // 3. Determine voice channel
        let channel = interaction.member.voice.channel;
        if (!channel) {
            // Try to find if bot is already in a channel (e.g. from autojoin)
            const me = interaction.guild.members.me;
            if (me.voice.channel) {
                channel = me.voice.channel;
            } else if (config[guildId] && config[guildId].settings && config[guildId].settings.vcId) {
                 // Try to fetch the channel from config
                 channel = interaction.guild.channels.cache.get(config[guildId].settings.vcId);
            }
        }

        if (!channel) {
            return interaction.reply('Could not determine voice channel. Please join a voice channel or set a default one.');
        }

        await interaction.reply(`Auto-playing: \`${playlistName}\` with ${playlist.length} songs.`);
        
        // 4. Start playback
        startMusicPlayback(interaction, channel, playlist);
    }
};
