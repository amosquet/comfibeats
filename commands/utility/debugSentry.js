const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const Sentry = require("@sentry/bun");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("debug-sentry")
    .setDescription("Tests Sentry integration by triggering various events")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The type of event to trigger")
        .setRequired(true)
        .addChoices(
          { name: "Exception", value: "exception" },
          { name: "Rejection", value: "rejection" },
          { name: "Warning", value: "warning" },
          { name: "Message", value: "message" },
        ),
    ),
  async execute(interaction) {
    const type = interaction.options.getString("type");

    await interaction.reply({
      content: `Triggering Sentry ${type}...`,
      ephemeral: true,
    });

    switch (type) {
      case "exception":
        throw new Error("Sentry Debug Exception: This is a test error.");
      case "rejection":
        Promise.reject(
          new Error("Sentry Debug Rejection: This is a test unhandled rejection."),
        );
        break;
      case "warning":
        process.emitWarning(
          "Sentry Debug Warning: This is a test process warning.",
          {
            name: "SentryDebugTestWarning",
            detail: "This should be captured by the new process.on('warning') handler.",
          },
        );
        break;
      case "message":
        Sentry.captureMessage("Sentry Debug Message: This is a test message.");
        break;
    }

    await interaction.followUp({
      content: `Sentry ${type} triggered. Please check your Sentry dashboard.`,
      ephemeral: true,
    });
  },
};
