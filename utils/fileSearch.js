const path = require("node:path");
const fs = require("node:fs");

/**
 * Searches for an audio file by name in the audio directory and its subdirectories.
 * @param {string} filename The name of the file to find
 * @returns {string|null} The absolute path to the file, or null if not found
 */
function findAudioFile(filename) {
  const audioDir = path.join(__dirname, "../audio");
  
  // Try direct path first for performance
  const directPath = path.join(audioDir, filename);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return directPath;
  }

  // Otherwise search recursively in user folders
  return searchRecursive(audioDir, filename);
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
    } else if (file === targetName) {
      return fullPath;
    }
  }
  
  return null;
}

module.exports = { findAudioFile };
