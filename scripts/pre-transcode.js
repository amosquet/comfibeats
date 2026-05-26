#!/usr/bin/env node
const path = require("node:path");
const { transcodeDirectory } = require("../utils/transcode");

/**
 * CLI wrapper for the transcoding utility.
 */
async function run() {
  const args = process.argv.slice(2);
  const input = args[0] || "audio";
  const output = args[1] || "transcoded";

  console.log(`Starting pre-transcoding...`);
  console.log(`Input Directory:  ${path.resolve(input)}`);
  console.log(`Output Directory: ${path.resolve(output)}`);
  console.log(`-----------------------------------`);

  let count = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    await transcodeDirectory(input, output, {
      onProgress: (event) => {
        if (event.type === "start") {
          process.stdout.write(`Transcoding: ${event.relativePath}... `);
        } else if (event.type === "success") {
          process.stdout.write(`DONE (${event.bitrate})\n`);
          successCount++;
        } else if (event.type === "error") {
          process.stdout.write(`FAILED: ${event.error}\n`);
          errorCount++;
        }
        count++;
      },
    });

    console.log(`-----------------------------------`);
    console.log(`Transcoding complete!`);
    console.log(`Total processed: ${successCount + errorCount}`);
    console.log(`Successful:      ${successCount}`);
    console.log(`Failed:          ${errorCount}`);
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module || !module.parent) {
  run().catch(console.error);
}
