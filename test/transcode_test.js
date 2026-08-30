const { describe, test, expect, beforeAll, afterAll } = require('bun:test');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const EventEmitter = require('node:events');
const ffmpegPath = require('ffmpeg-static');
const { transcodeFile, transcodeDirectory } = require('../utils/transcode');

describe('Transcode Pipeline Verification: utils/transcode.js', () => {
	const tempBase = path.resolve(__dirname, '_temp_transcode_test');
	const tempInDir = path.resolve(tempBase, 'input');
	const tempOutDir = path.resolve(tempBase, 'output');
	const sampleWav = path.resolve(tempInDir, 'sample.wav');
	const subSampleWav = path.resolve(tempInDir, 'sub', 'nested_sample.wav');
	const invalidSample = path.resolve(tempInDir, 'corrupt.mp3');
	const textFile = path.resolve(tempInDir, 'readme.txt');

	beforeAll(() => {
		// Clean up previous temp dir if existed
		if (fs.existsSync(tempBase)) {
			fs.rmSync(tempBase, { recursive: true, force: true });
		}

		fs.mkdirSync(path.resolve(tempInDir, 'sub'), { recursive: true });
		fs.mkdirSync(tempOutDir, { recursive: true });

		// Generate short 0.2s synthetic audio files with FFmpeg
		spawnSync(ffmpegPath, [
			'-f', 'lavfi',
			'-i', 'sine=frequency=440:duration=0.2',
			'-y', sampleWav,
		]);

		spawnSync(ffmpegPath, [
			'-f', 'lavfi',
			'-i', 'sine=frequency=880:duration=0.2',
			'-y', subSampleWav,
		]);

		// Create corrupt audio file (garbage content)
		fs.writeFileSync(invalidSample, 'THIS_IS_NOT_A_VALID_AUDIO_STREAM_HEADER');

		// Create non-audio file
		fs.writeFileSync(textFile, 'This should be ignored by the transcoder.');
	});

	afterAll(() => {
		if (fs.existsSync(tempBase)) {
			fs.rmSync(tempBase, { recursive: true, force: true });
		}
		const leftoverSine = path.resolve(__dirname, '../test_sine.wav');
		if (fs.existsSync(leftoverSine)) {
			fs.unlinkSync(leftoverSine);
		}
	});

	describe('transcodeFile()', () => {
		test('successfully transcodes a single audio file to Opus/Ogg format', async () => {
			const targetOgg = path.resolve(tempOutDir, 'single_test.ogg');
			const result = await transcodeFile(sampleWav, targetOgg, { bitrate: '96k' });

			expect(result).toBeDefined();
			expect(result.bitrate).toBe('96k');
			expect(fs.existsSync(targetOgg)).toBe(true);

			const stat = fs.statSync(targetOgg);
			expect(stat.size).toBeGreaterThan(0);
		});

		test('uses default 128k bitrate when none is specified', async () => {
			const targetOgg = path.resolve(tempOutDir, 'default_bitrate.ogg');
			const result = await transcodeFile(sampleWav, targetOgg);

			expect(result.bitrate).toBe('128k');
			expect(fs.existsSync(targetOgg)).toBe(true);
		});

		test('rejects with descriptive error when input file does not exist', async () => {
			const nonExistent = path.resolve(tempInDir, 'ghost.wav');
			const targetOgg = path.resolve(tempOutDir, 'ghost.ogg');

			let caughtErr = null;
			try {
				await transcodeFile(nonExistent, targetOgg);
			}
			catch (err) {
				caughtErr = err;
			}

			expect(caughtErr).toBeDefined();
			expect(caughtErr.message).toContain('FFmpeg process exited with code');
		});

		test('rejects with error when input audio file is corrupt', async () => {
			const targetOgg = path.resolve(tempOutDir, 'corrupt_out.ogg');

			let caughtErr = null;
			try {
				await transcodeFile(invalidSample, targetOgg);
			}
			catch (err) {
				caughtErr = err;
			}

			expect(caughtErr).toBeDefined();
			expect(caughtErr.message).toContain('FFmpeg process exited with code');
		});
	});

	describe('transcodeDirectory()', () => {
		test('recursively transcodes supported audio and emits progress events', async () => {
			const outDir = path.resolve(tempBase, 'dir_output');
			const eventsList = [];
			const emitter = new EventEmitter();

			emitter.on('progress', (e) => {
				eventsList.push(e);
			});
			emitter.on('error', () => {
				// Prevent unhandled error throw in EventEmitter
			});

			await transcodeDirectory(tempInDir, outDir, {
				bitrate: '128k',
				emitter: emitter,
			});

			// Verify transcoded output files exist
			expect(fs.existsSync(path.resolve(outDir, 'sample.ogg'))).toBe(true);
			expect(fs.existsSync(path.resolve(outDir, 'sub', 'nested_sample.ogg'))).toBe(true);

			// Verify non-audio text file was not converted
			expect(fs.existsSync(path.resolve(outDir, 'readme.txt'))).toBe(false);
			expect(fs.existsSync(path.resolve(outDir, 'readme.ogg'))).toBe(false);

			// Verify emitted events structure
			const startEvents = eventsList.filter((e) => e.type === 'start');
			const successEvents = eventsList.filter((e) => e.type === 'success');
			const errorEvents = eventsList.filter((e) => e.type === 'error');

			expect(startEvents.length).toBeGreaterThanOrEqual(2);
			expect(successEvents.length).toBe(2);
			// The corrupt.mp3 file
			expect(errorEvents.length).toBe(1);
			expect(errorEvents[0].relativePath).toBe('corrupt.mp3');
		});

		test('supports direct onProgress callback without EventEmitter', async () => {
			const outDir = path.resolve(tempBase, 'callback_output');
			const callbacks = [];

			await transcodeDirectory(tempInDir, outDir, {
				bitrate: '64k',
				onProgress: (event) => callbacks.push(event),
			});

			expect(callbacks.length).toBeGreaterThan(0);
			const successList = callbacks.filter((e) => e.type === 'success');
			expect(successList.length).toBe(2);
			expect(successList[0].bitrate).toBe('64k');
		});
	});
});
