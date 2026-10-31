const GUILD_ID = process.env.GUILD_ID;

const event = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`
    ############################################################
    #  Logged in as ${client.user.username}!
    #  Serving ${client.guilds.cache.size} servers.
    #  Serving ${client.users.cache.size} users.
    ############################################################
  `)
  
    // Tell Discord which slash commands exist so they show up in the "/" menu.
    // Registering to one server (GUILD_ID) updates instantly; global can be slow.
    const commandData = client.commands.map((command) => command.data.toJSON());
    if (GUILD_ID) {
      await client.application.commands.set(commandData, GUILD_ID);
    } else {
      await client.application.commands.set(commandData);
    }
    console.log(`Registered ${commandData.length} slash command(s).`);
  },
};

export default event;


