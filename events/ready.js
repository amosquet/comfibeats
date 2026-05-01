const { Events } = require("discord.js");
const { joinVoiceChannel } = require("@discordjs/voice");
const { getConfig } = require("../utils/configManager");
const { startMusicPlayback } = require("../commands/music/playlist");
const path = require("node:path");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const Sentry = require("@sentry/bun");

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Load config using the shared utility
    const config = await getConfig();

    // Iterate over guilds in config
    for (const guildId in config) {
      const guildConfig = config[guildId];
      if (
        guildConfig &&
        guildConfig.settings &&
        guildConfig.settings.autoVC &&
        guildConfig.settings.vcId
      ) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          try {
            const channel = guild.channels.cache.get(guildConfig.settings.vcId);
            if (!channel) {
              console.error(
                `Could not find channel ${guildConfig.settings.vcId} in guild ${guild.name}`,
              );
              continue;
            }

            // Join the voice channel
            joinVoiceChannel({
              channelId: channel.id,
              guildId: guildId,
              adapterCreator: guild.voiceAdapterCreator,
            });
            console.log(
              `Auto-joined voice channel ${channel.name} in guild ${guild.name} (${guildId})`,
            );

            // Trigger auto-play if configured
            if (
              guildConfig.settings.autoPlay &&
              guildConfig.settings.defaultPlaylist
            ) {
              const playlistName = guildConfig.settings.defaultPlaylist;
              const playlistFile = playlistName.endsWith(".json")
                ? playlistName
                : `${playlistName}.json`;
              const playlistPath = path.join(
                __dirname,
                "../playlists",
                playlistFile,
              );

              if (existsSync(playlistPath)) {
                try {
                  const data = await fs.readFile(playlistPath, "utf8");
                  const playlist = JSON.parse(data);

                  if (Array.isArray(playlist) && playlist.length > 0) {
                    console.log(
                      `Auto-playing playlist: ${playlistName} in ${guild.name}`,
                    );

                    // Create a mock interaction-like object for startMusicPlayback
                    const mockInteraction = {
                      guild: guild,
                      client: client,
                      member: { voice: { channel: channel } },
                    };

                    startMusicPlayback(
                      mockInteraction,
                      channel,
                      playlist,
                      guildConfig.settings.shuffle || false,
                    );
                  }
                } catch (err) {
                  Sentry.captureException(err);
                  console.error(
                    `Error parsing auto-play playlist for ${guild.name}:`,
                    err,
                  );
                }
              } else {
                console.warn(
                  `Auto-play failed: Playlist file ${playlistFile} not found.`,
                );
              }
            }
          } catch (error) {
            Sentry.captureException(error);
            console.error(
              `Failed to auto-join or auto-play in guild ${guildId}:`,
              error,
            );
          }
        }
      }
    }
  },
};
