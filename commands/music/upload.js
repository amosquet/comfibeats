const { SlashCommandBuilder } = require('discord.js');
const fs = require('node:fs/promises');
const { existsSync } = require('node:fs');
const path = require('node:path');
const Sentry = require('@sentry/bun');
const { checkModPermission } = require('../../utils/permissions');

const SUPPORTED_EXTENSIONS = ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac', '.opus'];
// 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('upload')
		.setDescription('Upload audio files to the bot\'s library (Moderators only)')
		.addAttachmentOption((option) =>
			option.setName('file1').setDescription('The first audio file to upload').setRequired(true),
		)
		.addAttachmentOption((option) =>
			option.setName('file2').setDescription('Optional second audio file').setRequired(false),
		)
		.addAttachmentOption((option) =>
			option.setName('file3').setDescription('Optional third audio file').setRequired(false),
		)
		.addAttachmentOption((option) =>
			option.setName('file4').setDescription('Optional fourth audio file').setRequired(false),
		)
		.addAttachmentOption((option) =>
			option.setName('file5').setDescription('Optional fifth audio file').setRequired(false),
		),

	async execute(interaction) {
		// 1. Check Permissions
		if (!(await checkModPermission(interaction))) {
			return interaction.reply({
				content: 'You do not have the required permissions to use this command.',
				ephemeral: true,
			});
		}

		// Defer the reply as downloading might take a while
		await interaction.deferReply();

		// 2. Gather attachments
		const attachments = [];
		for (let i = 1; i <= 5; i++) {
			const attachment = interaction.options.getAttachment(`file${i}`);
			if (attachment) {
				attachments.push(attachment);
			}
		}

		const successfulUploads = [];
		const relativePathsForAutoplaylist = [];
		const errors = [];

		const audioDir = path.resolve(__dirname, '../../audio');
		const userDir = path.resolve(audioDir, interaction.user.id);

		// Create user dir asynchronously if it doesn't exist
		try {
			await fs.mkdir(userDir, { recursive: true });
		}
		catch (err) {
			if (Sentry && typeof Sentry.captureException === 'function') {
				Sentry.captureException(err);
			}
			console.error('[upload.js] Error creating user directory:', err);
			return interaction.editReply('Internal error preparing upload destination.');
		}

		// 3. Process each attachment
		for (const attachment of attachments) {
			const ext = path.extname(attachment.name).toLowerCase();

			if (!SUPPORTED_EXTENSIONS.includes(ext)) {
				errors.push(`\`${attachment.name}\` failed: Unsupported file type. Supported types are ${SUPPORTED_EXTENSIONS.join(', ')}`);
				continue;
			}

			if (attachment.size > MAX_FILE_SIZE) {
				errors.push(`\`${attachment.name}\` failed: File exceeds the 50MB limit.`);
				continue;
			}

			try {
				const baseName = path.basename(attachment.name, ext).replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'upload';
				let finalFilename = `${baseName}${ext}`;
				let destPath = path.resolve(userDir, finalFilename);

				// Guarantee sandboxing strictly within userDir
				if (!destPath.startsWith(userDir + path.sep)) {
					errors.push(`\`${attachment.name}\` failed: Invalid file name (path traversal detected).`);
					continue;
				}

				// Handle name collisions safely
				let counter = 1;
				while (existsSync(destPath)) {
					finalFilename = `${baseName}(${counter})${ext}`;
					destPath = path.resolve(userDir, finalFilename);
					counter++;
				}

				// Asynchronous non-blocking download
				const response = await fetch(attachment.url);
				if (!response.ok) {
					throw new Error(`Failed to fetch attachment from CDN: ${response.statusText}`);
				}

				const arrayBuffer = await response.arrayBuffer();
				await fs.writeFile(destPath, Buffer.from(arrayBuffer));

				successfulUploads.push(finalFilename);
				relativePathsForAutoplaylist.push(`${interaction.user.id}/${finalFilename}`);
			}
			catch (error) {
				if (Sentry && typeof Sentry.captureException === 'function') {
					Sentry.captureException(error);
				}
				console.error(`[upload.js] Error processing attachment ${attachment.name}:`, error);
				errors.push(`\`${attachment.name}\` failed: Error while downloading/saving.`);
			}
		}

		// 4. Update autoplaylist.json using atomic write-rename
		if (relativePathsForAutoplaylist.length > 0) {
			try {
				const playlistDir = path.resolve(__dirname, '../../playlists');
				await fs.mkdir(playlistDir, { recursive: true });

				const playlistPath = path.resolve(playlistDir, 'autoplaylist.json');
				let playlistData = [];

				if (existsSync(playlistPath)) {
					try {
						const rawData = await fs.readFile(playlistPath, 'utf8');
						const parsed = JSON.parse(rawData);
						if (Array.isArray(parsed)) {
							playlistData = parsed;
						}
					}
					catch (e) {
						console.error('[upload.js] autoplaylist.json is corrupt or unreadable, initializing fresh array:', e);
						playlistData = [];
					}
				}

				// Append new songs
				playlistData.push(...relativePathsForAutoplaylist);

				// Atomic write via temporary file and rename
				const tempPath = `${playlistPath}.${Date.now()}.${Math.random().toString(36).substring(2)}.tmp`;
				await fs.writeFile(tempPath, JSON.stringify(playlistData, null, 4), 'utf8');
				await fs.rename(tempPath, playlistPath);
			}
			catch (error) {
				if (Sentry && typeof Sentry.captureException === 'function') {
					Sentry.captureException(error);
				}
				console.error('[upload.js] Error updating autoplaylist.json:', error);
				errors.push('Note: Successfully saved uploaded files, but could not update `autoplaylist.json`.');
			}
		}

		// 5. Construct final user response
		let responseText = '';
		if (successfulUploads.length > 0) {
			responseText += `✅ Successfully uploaded:\n- ${successfulUploads.map((f) => `\`${f}\``).join('\n- ')}\n`;
			responseText += '\n*These songs have been added to the library and `autoplaylist.json`.*';
		}

		if (errors.length > 0) {
			responseText += `\n\n❌ Errors:\n- ${errors.join('\n- ')}`;
		}

		if (responseText.trim() === '') {
			responseText = 'No files were processed.';
		}

		await interaction.editReply(responseText);
	},
};
