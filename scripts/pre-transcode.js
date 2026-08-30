#!/usr/bin/env node
const path = require('node:path');
const { transcodeDirectory } = require('../utils/transcode');

/**
 * CLI wrapper for the transcoding utility.
 */
async function run() {
	const args = process.argv.slice(2);

	if (args.includes('--help') || args.includes('-h')) {
		console.log('Usage: node scripts/pre-transcode.js [inputDir] [outputDir] [bitrate]');
		console.log('  inputDir:  Directory containing source audio files (default: \'audio\')');
		console.log('  outputDir: Directory to output transcoded .ogg files (default: \'transcoded\')');
		console.log('  bitrate:   Target audio bitrate (default: \'128k\')');
		process.exit(0);
	}

	const input = args[0] || 'audio';
	const output = args[1] || 'transcoded';
	const bitrate = args[2] || '128k';

	console.log('Starting pre-transcoding...');
	console.log(`Input Directory:  ${path.resolve(input)}`);
	console.log(`Output Directory: ${path.resolve(output)}`);
	console.log(`Bitrate:          ${bitrate}`);
	console.log('-----------------------------------');

	let successCount = 0;
	let errorCount = 0;

	try {
		await transcodeDirectory(input, output, {
			bitrate,
			onProgress: (event) => {
				if (event.type === 'start') {
					process.stdout.write(`Transcoding: ${event.relativePath}... `);
				}
				else if (event.type === 'success') {
					process.stdout.write(`DONE (${event.bitrate})\n`);
					successCount++;
				}
				else if (event.type === 'error') {
					process.stdout.write(`FAILED: ${event.error}\n`);
					errorCount++;
				}
			},
		});

		console.log('-----------------------------------');
		console.log('Transcoding complete!');
		console.log(`Total processed: ${successCount + errorCount}`);
		console.log(`Successful:      ${successCount}`);
		console.log(`Failed:          ${errorCount}`);

		process.exit(errorCount > 0 ? 1 : 0);
	}
	catch (err) {
		console.error(`Fatal error: ${err.message}`);
		process.exit(1);
	}
}

if (require.main === module || !module.parent) {
	run().catch((err) => {
		console.error('Unhandled execution error:', err);
		process.exit(1);
	});
}
