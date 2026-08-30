const {
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	entersState,
	joinVoiceChannel,
	getVoiceConnection,
} = require('@discordjs/voice');
const Sentry = require('@sentry/bun');
const { findAudioFile } = require('../utils/fileSearch');
const { getConfig } = require('../utils/configManager');

class GuildQueue {
	constructor(guild, textChannel, voiceChannel) {
		this.guild = guild;
		this.textChannel = textChannel;
		this.voiceChannel = voiceChannel;
		this.songs = [];
		this.index = 0;
		this.isSingleTrack = false;
		this.isDestroyed = false;
		this.consecutiveErrors = 0;
		this.idleTimer = null;
		this.isReconnecting = false;

		this.player = createAudioPlayer();

		// Check for existing connection or join new one
		const existingConnection = getVoiceConnection(guild.id);
		if (existingConnection && existingConnection.joinConfig.channelId === voiceChannel.id) {
			this.connection = existingConnection;
		}
		else {
			this.connection = joinVoiceChannel({
				channelId: voiceChannel.id,
				guildId: guild.id,
				adapterCreator: guild.voiceAdapterCreator,
			});
		}

		this.connection.subscribe(this.player);
		this.setupListeners();

		if (guild?.client) {
			if (guild.client.musicQueues) guild.client.musicQueues.set(guild.id, this);
			if (guild.client.musicQueue) guild.client.musicQueue.set(guild.id, this);
		}
	}

	setupListeners() {
		this.player.on(AudioPlayerStatus.Idle, () => this.handleIdle());

		this.player.on(AudioPlayerStatus.Playing, () => {
			this.consecutiveErrors = 0;
			this.clearIdleTimer();
		});

		this.player.on('error', (error) => {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(error);
			}
			console.error(`[GuildQueue ${this.guild.id}] AudioPlayer Error:`, error.message);
			this.consecutiveErrors++;
			if (this.consecutiveErrors >= 3) {
				console.error(`[GuildQueue ${this.guild.id}] Consecutive audio player errors threshold (3) reached. Halting playback.`);
				this.player.stop(true);
				this.startIdleTimer();
			}
			// Note: Do NOT manually advance queue or call playNext here.
			// @discordjs/voice automatically emits AudioPlayerStatus.Idle when player errors occur,
			// which triggers handleIdle() cleanly and avoids double-skipping tracks.
		});

		this.connection.on('error', (error) => {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(error);
			}
			console.error(`[GuildQueue ${this.guild.id}] VoiceConnection Error:`, error.message);
		});

		this.connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
			if (this.isDestroyed) return;

			// Reason 0 = WebSocketClose; 4014: Channel deleted or kicked from channel
			if (newState.reason === 0 && newState.closeCode === 4014) {
				try {
					await entersState(this.connection, VoiceConnectionStatus.Connecting, 5000);
				}
				catch {
					this.destroy();
				}
				return;
			}

			if (this.isReconnecting) return;
			this.isReconnecting = true;

			try {
				await Promise.race([
					entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
					entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
				]);
				this.isReconnecting = false;
			}
			catch {
				for (let attempt = 1; attempt <= 5; attempt++) {
					if (this.isDestroyed) return;
					try {
						console.log(`[GuildQueue ${this.guild.id}] Voice reconnect attempt ${attempt}/5...`);
						this.connection.rejoin();
						await entersState(this.connection, VoiceConnectionStatus.Ready, 5000);
						this.isReconnecting = false;
						return;
					}
					catch {
						await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
					}
				}
				console.warn(`[GuildQueue ${this.guild.id}] Voice reconnection failed after 5 attempts. Destroying queue.`);
				this.destroy();
			}
		});
	}

	setPlaylist(songs, shuffle = false, isSingleTrack = false) {
		this.songs = [...songs];
		this.isSingleTrack = isSingleTrack;
		if (shuffle) {
			this.shuffleAll();
		}
		this.index = 0;
	}

	shuffleAll() {
		for (let i = this.songs.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[this.songs[i], this.songs[j]] = [this.songs[j], this.songs[i]];
		}
	}

	shuffle() {
		if (this.songs.length <= 1) return;
		const currentSong = this.songs[this.index];
		const remaining = this.songs.filter((_, idx) => idx !== this.index);
		for (let i = remaining.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[remaining[i], remaining[j]] = [remaining[j], remaining[i]];
		}
		this.songs = [currentSong, ...remaining];
		this.index = 0;
	}

	async play() {
		if (this.isDestroyed || this.songs.length === 0) return;

		let attempts = 0;
		const maxAttempts = this.songs.length;

		while (attempts < maxAttempts) {
			if (this.index >= this.songs.length) {
				this.index = 0;
				try {
					const config = await getConfig();
					if (config[this.guild.id]?.settings?.shuffle) {
						this.shuffleAll();
					}
				}
				catch {
					// Ignore config read errors during in-flight playback loop
				}
			}

			const song = this.songs[this.index];
			const filePath = findAudioFile(song);

			if (filePath) {
				try {
					const resource = createAudioResource(filePath);
					this.player.play(resource);
					return;
				}
				catch (err) {
					if (Sentry && typeof Sentry.captureException === 'function') {
						Sentry.captureException(err);
					}
					console.error(`[GuildQueue ${this.guild.id}] Failed to create audio resource for ${song}:`, err);
				}
			}

			console.warn(`[GuildQueue ${this.guild.id}] Skipping unplayable song: ${song}`);
			this.index++;
			attempts++;
		}

		console.error(`[GuildQueue ${this.guild.id}] No playable tracks found in playlist.`);
		this.startIdleTimer();
	}

	async handleIdle() {
		if (this.isDestroyed || this.consecutiveErrors >= 3) return;

		if (this.isSingleTrack) {
			try {
				const config = await getConfig();
				if (config[this.guild.id]?.settings?.repeat && this.consecutiveErrors < 3) {
					this.play();
					return;
				}
			}
			catch (err) {
				console.error(`[GuildQueue ${this.guild.id}] Error reading config in handleIdle:`, err);
			}
			this.startIdleTimer();
			return;
		}

		this.index++;
		if (this.index >= this.songs.length) {
			this.index = 0;
			try {
				const config = await getConfig();
				if (config[this.guild.id]?.settings?.shuffle) {
					this.shuffleAll();
				}
			}
			catch {
				// Ignore config read error during idle advancement
			}
		}

		this.play();
	}

	startIdleTimer(timeoutMs = 5 * 60 * 1000) {
		this.clearIdleTimer();
		this.idleTimer = setTimeout(() => {
			console.log(`[GuildQueue ${this.guild.id}] Inactivity timeout reached. Destroying queue.`);
			this.destroy();
		}, timeoutMs);
	}

	clearIdleTimer() {
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
			this.idleTimer = null;
		}
	}

	stop() {
		if (this.player) {
			this.player.removeAllListeners();
			this.player.stop(true);
		}
		this.destroy();
	}

	destroy() {
		if (this.isDestroyed) return;
		this.isDestroyed = true;
		this.clearIdleTimer();

		if (this.player) {
			this.player.removeAllListeners();
			this.player.stop(true);
		}

		if (this.connection) {
			this.connection.removeAllListeners();
			try {
				this.connection.destroy();
			}
			catch {
				// Ignore voice connection destroy error
			}
		}

		if (this.guild?.client?.musicQueues) {
			this.guild.client.musicQueues.delete(this.guild.id);
		}
		if (this.guild?.client?.musicQueue) {
			this.guild.client.musicQueue.delete(this.guild.id);
		}
	}
}

module.exports = { GuildQueue };
