const path = require('node:path');
const fs = require('node:fs');

/**
 * Checks whether a targetPath is strictly inside a baseDir.
 * @param {string} baseDir Base directory path
 * @param {string} targetPath Target file/directory path
 * @returns {boolean} True if targetPath is inside baseDir, false otherwise
 */
function isPathInside(baseDir, targetPath) {
	const rel = path.relative(baseDir, targetPath);
	return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Searches for an audio file by name in the audio directory and its subdirectories with strict path sandboxing.
 * @param {string} filename The name of the file to find
 * @returns {string|null} The absolute path to the file, or null if not found
 */
function findAudioFile(filename) {
	if (!filename || typeof filename !== 'string') return null;
	const audioDir = path.resolve(__dirname, '../audio');

	// Sanitize: allow subdirectories inside audioDir, but reject traversal outside audioDir
	const directPath = path.resolve(audioDir, filename);

	if (isPathInside(audioDir, directPath) && fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
		return directPath;
	}

	// Fallback: search recursively strictly by base filename
	const safeBaseName = path.basename(filename);
	return searchRecursive(audioDir, safeBaseName);
}

function searchRecursive(dir, targetName) {
	if (!fs.existsSync(dir)) return null;
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const fullPath = path.join(dir, file);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			const found = searchRecursive(fullPath, targetName);
			if (found) return found;
		}
		else if (file.toLowerCase() === targetName.toLowerCase()) {
			return fullPath;
		}
	}
	return null;
}

module.exports = {
	findAudioFile,
	isPathInside,
};
