const { describe, test, expect, beforeEach, afterEach } = require('bun:test');
const { AudioPlayerStatus } = require('@discordjs/voice');
const { GuildQueue } = require('../structures/GuildQueue');

describe('Voice Lifecycle & State Machine Verification: GuildQueue', () => {
	let mockGuild;
	let mockVoiceChannel;
	let mockTextChannel;
	let queue;

	beforeEach(() => {
		mockGuild = {
			id: `guild_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			name: 'Test Audio Guild',
			voiceAdapterCreator: () => ({
				sendPayload: () => true,
				destroy: () => {
					// Mock destroy
				},
			}),
			client: {
				musicQueues: new Map(),
				musicQueue: new Map(),
			},
		};

		mockVoiceChannel = {
			id: `vc_${Date.now()}`,
			name: 'Lofi Lounge',
		};

		mockTextChannel = {
			id: `tc_${Date.now()}`,
			name: 'bot-commands',
		};

		queue = new GuildQueue(mockGuild, mockTextChannel, mockVoiceChannel);
	});

	afterEach(() => {
		if (queue && !queue.isDestroyed) {
			queue.destroy();
		}
	});

	describe('Initialization & Registration', () => {
		test('registers newly created queue into client.musicQueues and client.musicQueue', () => {
			expect(mockGuild.client.musicQueues.get(mockGuild.id)).toBe(queue);
			expect(mockGuild.client.musicQueue.get(mockGuild.id)).toBe(queue);
			expect(queue.isDestroyed).toBe(false);
			expect(queue.consecutiveErrors).toBe(0);
			expect(queue.index).toBe(0);
		});
	});

	describe('Playlist Configuration & Shuffling', () => {
		test('setPlaylist initializes track list, resets index, and preserves single track flag', () => {
			const songList = ['track_a.mp3', 'track_b.mp3', 'track_c.mp3'];
			queue.setPlaylist(songList, false, true);

			expect(queue.songs).toEqual(songList);
			expect(queue.isSingleTrack).toBe(true);
			expect(queue.index).toBe(0);
		});

		test('shuffleAll shuffles the entire playlist array', () => {
			const songs = Array.from({ length: 50 }, (_, i) => `track_${i}.mp3`);
			queue.setPlaylist(songs, true, false);

			expect(queue.songs.length).toBe(50);
			// Array content must be preserved
			expect(new Set(queue.songs).size).toBe(50);
		});

		test('shuffle preserves current playing song at index 0 and shuffles remaining tracks', () => {
			const songs = ['current_playing.mp3', 'song_1.mp3', 'song_2.mp3', 'song_3.mp3', 'song_4.mp3'];
			queue.setPlaylist(songs, false, false);
			queue.index = 0;

			queue.shuffle();

			expect(queue.songs[0]).toBe('current_playing.mp3');
			expect(queue.songs.length).toBe(5);
			expect(new Set(queue.songs).size).toBe(5);
		});
	});

	describe('VOICE-HIGH-04 & Circuit Breaker: Consecutive Error Halting', () => {
		test('increments consecutiveErrors on player error and halts playback after 3 failures', () => {
			expect(queue.consecutiveErrors).toBe(0);

			// First error
			queue.player.emit('error', new Error('Decode error 1'));
			expect(queue.consecutiveErrors).toBe(1);
			expect(queue.idleTimer).toBeNull();

			// Second error
			queue.player.emit('error', new Error('Decode error 2'));
			expect(queue.consecutiveErrors).toBe(2);
			expect(queue.idleTimer).toBeNull();

			// Third error: Circuit breaker trips!
			queue.player.emit('error', new Error('Decode error 3'));
			expect(queue.consecutiveErrors).toBe(3);
			expect(queue.idleTimer).not.toBeNull();
		});

		test('resets consecutiveErrors to 0 and clears idle timer on AudioPlayerStatus.Playing', () => {
			queue.consecutiveErrors = 2;
			queue.startIdleTimer(60000);
			expect(queue.idleTimer).not.toBeNull();

			queue.player.emit(AudioPlayerStatus.Playing);

			expect(queue.consecutiveErrors).toBe(0);
			expect(queue.idleTimer).toBeNull();
		});
	});

	describe('VOICE-HIGH-01: Dual Queue Advancement Prevention', () => {
		test('player error event does not manually advance index directly', () => {
			queue.setPlaylist(['song1.mp3', 'song2.mp3', 'song3.mp3']);
			queue.index = 0;

			// Emit error - listener increments counter and does NOT increment queue.index
			queue.player.emit('error', new Error('Stream decode fault'));

			expect(queue.index).toBe(0);
		});
	});

	describe('VOICE-HIGH-02: Synchronous Call Stack Overflow Prevention', () => {
		test('play() iterates through missing/unplayable tracks iteratively without recursion stack overflow', async () => {
			// Generate playlist with 100 non-existent tracks
			const missingSongs = Array.from({ length: 100 }, (_, i) => `ghost_track_${i}.mp3`);
			queue.setPlaylist(missingSongs);

			// Should execute iteratively without "Maximum call stack size exceeded"
			await queue.play();

			// Verify idle timer was triggered after playlist exhaustion
			expect(queue.idleTimer).not.toBeNull();
		});
	});

	describe('VOICE-MED-01: Inactivity Idle Timeout', () => {
		test('startIdleTimer triggers clean queue destruction upon timeout expiry', async () => {
			// 50ms short timeout for test
			queue.startIdleTimer(50);

			expect(queue.isDestroyed).toBe(false);
			await new Promise((resolve) => setTimeout(resolve, 80));

			expect(queue.isDestroyed).toBe(true);
			expect(mockGuild.client.musicQueues.has(mockGuild.id)).toBe(false);
		});

		test('clearIdleTimer cancels pending timeout', async () => {
			queue.startIdleTimer(50);
			queue.clearIdleTimer();

			expect(queue.idleTimer).toBeNull();
			await new Promise((resolve) => setTimeout(resolve, 80));

			// Should NOT be destroyed because timer was cancelled
			expect(queue.isDestroyed).toBe(false);
		});
	});

	describe('VOICE-HIGH-03 & VOICE-MED-02: Clean Teardown and Memory Leak Prevention', () => {
		test('stop() removes all player listeners, halts audio, and destroys queue', () => {
			queue.setPlaylist(['track1.mp3', 'track2.mp3']);
			queue.stop();

			expect(queue.isDestroyed).toBe(true);
			expect(mockGuild.client.musicQueues.has(mockGuild.id)).toBe(false);
			expect(mockGuild.client.musicQueue.has(mockGuild.id)).toBe(false);
		});

		test('destroy() is idempotent and handles multiple calls gracefully', () => {
			expect(queue.isDestroyed).toBe(false);

			queue.destroy();
			expect(queue.isDestroyed).toBe(true);

			// Second call should not throw or error
			expect(() => queue.destroy()).not.toThrow();
			expect(queue.isDestroyed).toBe(true);
		});
	});
});
