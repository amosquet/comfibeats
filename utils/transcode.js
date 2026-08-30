const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const EventEmitter = require('node:events');
const ffmpegPath = require('ffmpeg-static');

/**
 * Transcodes a single audio file to Opus/Ogg format.
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {Object} options
 * @returns {Promise<{bitrate: string}>}
 */
async function transcodeFile(inputPath, outputPath, options = {}) {
	const bitrate = options.bitrate || '128k';
	return new Promise((resolve, reject) => {
		const args = [
			'-y',
			'-i', inputPath,
			'-vn',
			'-c:a', 'libopus',
			'-b:a', bitrate,
			'-f', 'ogg',
			outputPath,
		];

		const ffmpeg = spawn(ffmpegPath, args);

		ffmpeg.on('close', (code) => {
			if (code === 0) {
				resolve({ bitrate });
			}
			else {
				reject(new Error(`FFmpeg process exited with code ${code}`));
			}
		});

		ffmpeg.on('error', (err) => {
			reject(err);
		});
	});
}

/**
 * Recursively transcodes all supported audio files in a directory tree.
 * Supports progress reporting via options.onProgress callback or options.emitter (EventEmitter).
 * @param {string} inputDir
 * @param {string} outputDir
 * @param {Object} options
 */
async function transcodeDirectory(inputDir, outputDir, options = {}) {
	const onProgress = typeof options.onProgress === 'function' ? options.onProgress : () => {
		// Default progress callback noop
	};
	const emitter = options.emitter instanceof EventEmitter ? options.emitter : null;

	const emitEvent = (event) => {
		onProgress(event);
		if (emitter) {
			emitter.emit(event.type, event);
			emitter.emit('progress', event);
		}
	};

	const resolvedInput = path.resolve(inputDir);
	const resolvedOutput = path.resolve(outputDir);

	await fs.mkdir(resolvedOutput, { recursive: true });

	const supportedExtensions = /\.(mp3|wav|flac|m4a|aac|ogg)$/i;

	async function walk(currentDir) {
		const entries = await fs.readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const srcPath = path.join(currentDir, entry.name);
			const relPath = path.relative(resolvedInput, srcPath);
			const outPath = path.join(
				resolvedOutput,
				relPath.replace(/\.[^/.]+$/, '.ogg'),
			);

			if (entry.isDirectory()) {
				await fs.mkdir(path.dirname(outPath), { recursive: true });
				await walk(srcPath);
			}
			else if (entry.isFile() && supportedExtensions.test(entry.name)) {
				await fs.mkdir(path.dirname(outPath), { recursive: true });
				emitEvent({ type: 'start', relativePath: relPath });
				try {
					const res = await transcodeFile(srcPath, outPath, options);
					emitEvent({
						type: 'success',
						relativePath: relPath,
						bitrate: res.bitrate,
					});
				}
				catch (err) {
					emitEvent({
						type: 'error',
						relativePath: relPath,
						error: err.message,
					});
				}
			}
		}
	}

	await walk(resolvedInput);
}

module.exports = {
	transcodeFile,
	transcodeDirectory,
};
