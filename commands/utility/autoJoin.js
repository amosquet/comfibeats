const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');

// Try to require config, default to empty object if missing to prevent crash during development if file is missing
let config;
try {
    config = require('../../guild_settings.json');
} catch (err) {
    config = {};
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autojoin')
        .setDescription('Toggles auto-join for the default voice channel.'),
    async execute(interaction) {
        const guildId = interaction.guild.id;

        // Ensure guild config structure exists
        if (!config[guildId]) {
            config[guildId] = {
                settings: {
                    autoVC: false,
                    vcId: null
                }
            };
        }
        if (!config[guildId].settings) {
            config[guildId].settings = {};
        }

        // Toggle autoVC
        const currentAutoVC = config[guildId].settings.autoVC || false;
        const newAutoVC = !currentAutoVC;
        config[guildId].settings.autoVC = newAutoVC;

        // Save config
        try {
            // Write to guild_settings.json in the project root
            const configPath = path.join(__dirname, '../../guild_settings.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 4));
        } catch (err) {
            console.error('Error writing to guild_settings.json:', err);
            return interaction.reply({ content: 'Failed to save settings.', ephemeral: true });
        }

        let replyMessage = `Auto-join has been turned **${newAutoVC ? 'ON' : 'OFF'}**.`;

        // If turned ON, join the channel immediately
        if (newAutoVC) {
            const channelId = config[guildId].settings.vcId;
            if (channelId) {
                try {
                    joinVoiceChannel({
                        channelId: channelId,
                        guildId: guildId,
                        adapterCreator: interaction.guild.voiceAdapterCreator
                    });
                    replyMessage += ` Joining voice channel <#${channelId}>.`;
                } catch (error) {
                    console.error(error);
                    replyMessage += ` Failed to join voice channel.`;
                }
            } else {
                replyMessage += ` No default voice channel set. Use \`/setvc\` to set one.`;
            }
        }

        await interaction.reply(replyMessage);
    }
};
