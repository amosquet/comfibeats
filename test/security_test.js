const { describe, test, expect, beforeAll, afterAll } = require('bun:test');
const path = require('node:path');
const fs = require('node:fs');
const { findAudioFile, isPathInside } = require('../utils/fileSearch');

describe('Security Verification: Path Traversal & Sandboxing', () => {
	const audioDir = path.resolve(__dirname, '../audio');
	const playlistsDir = path.resolve(__dirname, '../playlists');
	const testSubdir = path.resolve(audioDir, '_sec_test_sub');
	const testAudioFile = path.resolve(testSubdir, 'sec_sample.mp3');

	beforeAll(() => {
		if (!fs.existsSync(testSubdir)) {
			fs.mkdirSync(testSubdir, { recursive: true });
		}
		fs.writeFileSync(testAudioFile, 'dummy audio data');
	});

	afterAll(() => {
		if (fs.existsSync(testAudioFile)) {
			fs.unlinkSync(testAudioFile);
		}
		if (fs.existsSync(testSubdir)) {
			fs.rmdirSync(testSubdir);
		}
	});

	describe('SEC-CRIT-01: utils/fileSearch.js path traversal protection', () => {
		test('isPathInside correctly detects paths inside and outside directory', () => {
			const base = path.resolve('/var/data/audio');
			expect(isPathInside(base, path.resolve('/var/data/audio/track.mp3'))).toBe(true);
			expect(isPathInside(base, path.resolve('/var/data/audio/sub/track.mp3'))).toBe(true);
			expect(isPathInside(base, path.resolve('/var/data/secret.txt'))).toBe(false);
			expect(isPathInside(base, path.resolve('/etc/passwd'))).toBe(false);
			expect(isPathInside(base, path.resolve('/var/data/audio/../secret.txt'))).toBe(false);
		});

		test('findAudioFile blocks directory traversal sequences', () => {
			expect(findAudioFile('../../guild_settings.json')).toBeNull();
			expect(findAudioFile('../../../etc/passwd')).toBeNull();
			expect(findAudioFile('../../../../etc/shadow')).toBeNull();
			expect(findAudioFile('../../package.json')).toBeNull();
			expect(findAudioFile('../../AUDIT_REPORT.md')).toBeNull();
			expect(findAudioFile('../audio/../../package.json')).toBeNull();
			expect(findAudioFile('_sec_test_sub/../../package.json')).toBeNull();
		});

		test('findAudioFile blocks absolute paths pointing outside audio directory', () => {
			expect(findAudioFile('/etc/passwd')).toBeNull();
			expect(findAudioFile('/etc/shadow')).toBeNull();
			expect(findAudioFile(path.resolve(__dirname, '../package.json'))).toBeNull();
		});

		test('findAudioFile safely handles invalid or empty inputs', () => {
			expect(findAudioFile('')).toBeNull();
			expect(findAudioFile(null)).toBeNull();
			expect(findAudioFile(undefined)).toBeNull();
			expect(findAudioFile(12345)).toBeNull();
			expect(findAudioFile({})).toBeNull();
			expect(findAudioFile([])).toBeNull();
		});

		test('findAudioFile finds valid audio files inside subdirectories', () => {
			const foundByRel = findAudioFile('_sec_test_sub/sec_sample.mp3');
			expect(foundByRel).toBe(testAudioFile);

			const foundByBase = findAudioFile('sec_sample.mp3');
			expect(foundByBase).toBe(testAudioFile);
		});
	});

	describe('SEC-CRIT-02: Playlist name traversal and validation', () => {
		function sanitizeAndValidatePlaylist(rawName) {
			const sanitizedName = path.basename(
				rawName.endsWith('.json') ? rawName : `${rawName}.json`,
			);
			const playlistPath = path.resolve(playlistsDir, sanitizedName);
			const rel = path.relative(playlistsDir, playlistPath);

			if (rel.startsWith('..') || path.isAbsolute(rel)) {
				return { valid: false, error: 'Traversal detected' };
			}
			return { valid: true, path: playlistPath, name: sanitizedName };
		}

		test('sanitizes playlist names and blocks traversal sequences', () => {
			const result1 = sanitizeAndValidatePlaylist('../../evil');
			expect(result1.valid).toBe(true);
			expect(result1.name).toBe('evil.json');
			expect(isPathInside(playlistsDir, result1.path)).toBe(true);

			const result2 = sanitizeAndValidatePlaylist('../../../etc/passwd');
			expect(result2.valid).toBe(true);
			expect(result2.name).toBe('passwd.json');
			expect(isPathInside(playlistsDir, result2.path)).toBe(true);

			const result3 = sanitizeAndValidatePlaylist('my_lofi_list');
			expect(result3.valid).toBe(true);
			expect(result3.name).toBe('my_lofi_list.json');
			expect(result3.path).toBe(path.resolve(playlistsDir, 'my_lofi_list.json'));
		});
	});

	describe('SEC-CRIT-03: generateplaylist folder and playlist name validation', () => {
		function validateGeneratePlaylistOptions(rawName, rawFolder) {
			const baseAudioPath = path.resolve(__dirname, '../audio');
			const basePlaylistPath = path.resolve(__dirname, '../playlists');

			const safePlaylistName = path.basename(rawName).replace(/[^a-zA-Z0-9_-]/g, '');
			if (!safePlaylistName) {
				return { valid: false, error: 'Invalid playlist name specified.' };
			}

			const playlistPath = path.resolve(basePlaylistPath, `${safePlaylistName}.json`);
			if (!playlistPath.startsWith(basePlaylistPath + path.sep)) {
				return { valid: false, error: 'Invalid playlist path.' };
			}

			let audioPath = baseAudioPath;
			if (rawFolder) {
				audioPath = path.resolve(baseAudioPath, rawFolder);
				if (!audioPath.startsWith(baseAudioPath + path.sep) && audioPath !== baseAudioPath) {
					return { valid: false, error: 'Invalid folder path specified.' };
				}
			}

			return { valid: true, playlistPath, audioPath, safePlaylistName };
		}

		test('rejects malicious or invalid playlist names', () => {
			expect(validateGeneratePlaylistOptions('../../../', null).valid).toBe(false);
			expect(validateGeneratePlaylistOptions('$$$###', null).valid).toBe(false);
			expect(validateGeneratePlaylistOptions('', null).valid).toBe(false);
		});

		test('sanitizes valid alphanumeric playlist names', () => {
			const res = validateGeneratePlaylistOptions('my-playlist_01', null);
			expect(res.valid).toBe(true);
			expect(res.safePlaylistName).toBe('my-playlist_01');
		});

		test('rejects directory traversal in folder option', () => {
			expect(validateGeneratePlaylistOptions('valid_name', '../../').valid).toBe(false);
			expect(validateGeneratePlaylistOptions('valid_name', '/etc').valid).toBe(false);
			expect(validateGeneratePlaylistOptions('valid_name', '../commands').valid).toBe(false);
			expect(validateGeneratePlaylistOptions('valid_name', 'sub/../../outside').valid).toBe(false);
		});

		test('accepts valid subfolder inside audio directory', () => {
			const res = validateGeneratePlaylistOptions('valid_name', 'subfolder');
			expect(res.valid).toBe(true);
			expect(res.audioPath).toBe(path.resolve(audioDir, 'subfolder'));
		});
	});

	describe('SEC-CRIT-04: upload filename sanitization & sandboxing', () => {
		const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus'];
		const MAX_FILE_SIZE = 50 * 1024 * 1024;

		function processAttachment(filename, size, userId) {
			const ext = path.extname(filename).toLowerCase();
			if (!SUPPORTED_EXTENSIONS.includes(ext)) {
				return { valid: false, error: 'Unsupported file type' };
			}
			if (size > MAX_FILE_SIZE) {
				return { valid: false, error: 'File exceeds 50MB limit' };
			}

			const userDir = path.resolve(audioDir, userId);
			const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'upload';
			const finalFilename = `${baseName}${ext}`;
			const destPath = path.resolve(userDir, finalFilename);

			if (!destPath.startsWith(userDir + path.sep)) {
				return { valid: false, error: 'Path traversal detected' };
			}

			return { valid: true, destPath, finalFilename };
		}

		test('rejects unsupported file extensions', () => {
			expect(processAttachment('malicious.exe', 1000, 'user123').valid).toBe(false);
			expect(processAttachment('script.sh', 1000, 'user123').valid).toBe(false);
			expect(processAttachment('config.json', 1000, 'user123').valid).toBe(false);
			expect(processAttachment('backdoor.php', 1000, 'user123').valid).toBe(false);
			expect(processAttachment('index.js', 1000, 'user123').valid).toBe(false);
		});

		test('rejects files exceeding maximum size', () => {
			expect(processAttachment('huge_song.mp3', 51 * 1024 * 1024, 'user123').valid).toBe(false);
		});

		test('sanitizes traversal sequences and strips dangerous path characters in filenames', () => {
			const res1 = processAttachment('../../exploit.mp3', 1024, 'user123');
			expect(res1.valid).toBe(true);
			expect(res1.finalFilename).toBe('exploit.mp3');
			expect(res1.destPath.startsWith(path.resolve(audioDir, 'user123'))).toBe(true);

			const res2 = processAttachment('../../../evil_name.flac', 2048, 'user456');
			expect(res2.valid).toBe(true);
			expect(res2.finalFilename).toBe('evil_name.flac');
		});

		test('accepts valid audio attachments within size limits', () => {
			for (const ext of SUPPORTED_EXTENSIONS) {
				const res = processAttachment(`valid_audio${ext}`, 5 * 1024 * 1024, 'user789');
				expect(res.valid).toBe(true);
				expect(res.finalFilename).toBe(`valid_audio${ext}`);
			}
		});
	});
});
