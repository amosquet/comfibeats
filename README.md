# comfibeats

A custom Discord music bot built with [Bun](https://bun.com) and discord.js, designed to be reliable, customizable, and easy to self-host.

## Features

- **Music Playback:** Play music, shuffle, stop, and manage queues.
- **Custom Playlists:** Create and play JSON-based playlists generated directly from local audio files.
- **Auto-Join & Auto-Play:** Configurable settings to automatically join a designated Voice Channel and start playing a default playlist.
- **Per-Guild Settings:** Customize behavior per server, including auto-play, default playlists, and shuffle/repeat options.
- **Self-Updating:** Includes a `/update` command and scripts to pull the latest changes from GitHub and restart the bot automatically.
- **Systemd Service Support:** Comes with setup scripts for easy deployment as a background service on Linux.

## Setup

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Configuration:**
   - Copy `.env.EXAMPLE` to `.env` and fill in your `DISCORD_AUTH` token and `CLIENT_ID`.
   - Copy `guild_settings.json.example` to `guild_settings.json` and configure your server ID, roles, and default settings.

3. **Run the bot:**
   ```bash
   bun run index.js
   ```

## Deployment (Systemd Service)

For self-hosting on Linux, you can install comfibeats as a systemd service.

- Run the automated setup script:
  ```bash
  chmod +x setup_service.sh
  ./setup_service.sh
  ```
- See [SERVICE_SETUP.md](SERVICE_SETUP.md) for more detailed instructions on manual setup and service management.

## Commands

- **Music:** `/play`, `/playlist`, `/shuffle`, `/stop`
- **Utility:** `/settings`, `/generateplaylist`, `/joinVC`, `/leaveVC`, `/update`

---

_Created because I wanted a bot that doesn't crash. (Currently hosted on an Arch Linux container.)_
