const { SlashCommandBuilder } = require("discord.js");
const { getConfig } = require("../../utils/configManager");
const fs = require("node:fs");
const path = require("node:path");
const Sentry = require("@sentry/bun");

const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".flac", ".ogg"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upload")
    .setDescription("Upload audio files to the bot's library (Moderators only)")
    .addAttachmentOption((option) =>
      option.setName("file1").setDescription("The first audio file to upload").setRequired(true)
    )
    .addAttachmentOption((option) =>
      option.setName("file2").setDescription("Optional second audio file").setRequired(false)
    )
    .addAttachmentOption((option) =>
      option.setName("file3").setDescription("Optional third audio file").setRequired(false)
    )
    .addAttachmentOption((option) =>
      option.setName("file4").setDescription("Optional fourth audio file").setRequired(false)
    )
    .addAttachmentOption((option) =>
      option.setName("file5").setDescription("Optional fifth audio file").setRequired(false)
    ),

  async execute(interaction) {
    // 1. Check Permissions
    const guildId = interaction.guild.id;
    const config = await getConfig();
    const modRole = config[guildId]?.roles?.modRole;

    if (!modRole) {
      return interaction.reply({ content: "The moderator role is not configured for this server. Please check your settings.", ephemeral: true });
    }

    const modRolesArray = Array.isArray(modRole) ? modRole : [modRole];
    
    const hasModRole = modRolesArray.some(roleId => interaction.member.roles.cache.has(roleId));

    if (!hasModRole) {
      return interaction.reply({ content: "You do not have the required permissions to use this command.", ephemeral: true });
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
    const errors = [];

    const audioDir = path.join(__dirname, "../../audio");
    const userDir = path.join(audioDir, interaction.user.id);

    // Create user dir if it doesn't exist
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    // 3. Process each attachment
    for (const attachment of attachments) {
      const ext = path.extname(attachment.name).toLowerCase();
      
      if (!SUPPORTED_EXTENSIONS.includes(ext)) {
        errors.push(`\`${attachment.name}\` failed: Unsupported file type. Supported types are ${SUPPORTED_EXTENSIONS.join(", ")}`);
        continue;
      }

      if (attachment.size > MAX_FILE_SIZE) {
        errors.push(`\`${attachment.name}\` failed: File is larger than the 50MB limit.`);
        continue;
      }

      try {
        let finalFilename = attachment.name;
        let destPath = path.join(userDir, finalFilename);
        
        // Handle name collisions
        let counter = 1;
        const baseName = path.basename(attachment.name, ext);
        while (fs.existsSync(destPath)) {
          finalFilename = `${baseName}(${counter})${ext}`;
          destPath = path.join(userDir, finalFilename);
          counter++;
        }

        // Download the file
        const response = await fetch(attachment.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${attachment.url}: ${response.statusText}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        fs.writeFileSync(destPath, buffer);

        successfulUploads.push(finalFilename);
      } catch (error) {
        Sentry.captureException(error);
        console.error(`Error processing attachment ${attachment.name}:`, error);
        errors.push(`\`${attachment.name}\` failed: Internal error while downloading/saving.`);
      }
    }

    // 4. Update autoplaylist.json if any successes
    if (successfulUploads.length > 0) {
      try {
        const playlistDir = path.join(__dirname, "../../playlists");
        if (!fs.existsSync(playlistDir)) {
          fs.mkdirSync(playlistDir, { recursive: true });
        }
        
        const playlistPath = path.join(playlistDir, "autoplaylist.json");
        let playlistData = [];
        
        if (fs.existsSync(playlistPath)) {
          const rawData = fs.readFileSync(playlistPath, "utf8");
          try {
            playlistData = JSON.parse(rawData);
          } catch (e) {
            console.error("Autoplaylist is corrupt, resetting.");
            playlistData = [];
          }
        }
        
        // Append new songs
        playlistData.push(...successfulUploads);
        fs.writeFileSync(playlistPath, JSON.stringify(playlistData, null, 2));
      } catch (error) {
        Sentry.captureException(error);
        console.error("Error updating autoplaylist:", error);
        errors.push("Note: Successfully uploaded files but failed to update `autoplaylist.json`.");
      }
    }

    // 5. Construct final response
    let responseText = "";
    if (successfulUploads.length > 0) {
      responseText += `✅ Successfully uploaded: \n- ${successfulUploads.map(f => `\`${f}\``).join("\n- ")}\n`;
      responseText += `\n*These songs have been added to the end of the \`autoplaylist\` playlist.*`;
    }
    
    if (errors.length > 0) {
      responseText += `\n\n❌ Errors:\n- ${errors.join("\n- ")}`;
    }

    if (responseText.trim() === "") {
      responseText = "No files were processed.";
    }

    await interaction.editReply(responseText);
  },
};
