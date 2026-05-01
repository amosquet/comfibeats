
try {
  const playlist = require('./commands/music/playlist.js');
  console.log('Successfully required playlist.js');
  if (typeof playlist.startMusicPlayback === 'function') {
      console.log('startMusicPlayback is exported correctly');
  } else {
      console.error('startMusicPlayback is NOT formatted correctly');
      process.exit(1);
  }
} catch (e) {
  console.error('Failed to require playlist.js:', e);
  process.exit(1);
}
