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
  
  // TEMPORARY TEST
const guild = client.guilds.cache.first();
const member = await guild.members.fetch(client.user.id);
client.emit("guildMemberAdd", member);
  },
};

export default event;


