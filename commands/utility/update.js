const { SlashCommandBuilder } = require("discord.js");
const { exec } = require("child_process");
const Sentry = require("@sentry/bun");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("update")
    .setDescription("Pulls the latest changes and updates the bot (Owner only)."),
  async execute(interaction) {
    // Check if user is the application owner
    if (!interaction.client.application.owner) {
      await interaction.client.application.fetch();
    }
    const owner = interaction.client.application.owner;
    const isOwner = owner.members
      ? owner.members.has(interaction.user.id)
      : owner.id === interaction.user.id;

    if (!isOwner) {
      return interaction.reply({
        content: "You do not have permission to run this command.",
        ephemeral: true,
      });
    }

    await interaction.reply("📥 Starting update... Pulling latest changes and restarting service.");

    // Run the update script
    // We execute it in the background/asynchronously and let it restart the service.
    // The service restart will kill this process, so we won't be able to send a success message from here.
    // That's why we reply to the interaction first.
    exec("bash ./update_comfibeats.sh", (error, stdout, stderr) => {
      if (error) {
        Sentry.captureException(error);
        console.error(`Error during update: ${error.message}`);
        interaction.followUp({
          content: `❌ Update failed: ${error.message}`,
          ephemeral: true,
        }).catch(console.error);
        return;
      }
      if (stderr) {
        console.error(`Update stderr: ${stderr}`);
      }
      console.log(`Update stdout: ${stdout}`);
    });
  },
};
