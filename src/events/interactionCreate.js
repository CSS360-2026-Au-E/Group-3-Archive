// Fires every time someone uses a slash command (or button, menu, etc.).
const event = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return; // ignore non-slash interactions

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`No command found for /${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      // Safety net in case a command throws before it can reply itself.
      console.error(`Error running /${interaction.commandName}:`, error);
      const reply = { content: "Something went wrong running that command.", ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(reply).catch(() => {});
      } else {
        await interaction.reply(reply).catch(() => {});
      }
    }
  },
};

export default event;