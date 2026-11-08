// Registers the slash commands with Discord. Run it once, and again whenever you
// change a command's name, description, or options (not every time the bot starts):
//
//   npm run deploy
//
// Settings in .env:
//   TOKEN=...       your bot token (same as bot.js)
//   CLIENT_ID=...   Developer Portal -> your app -> General Information -> Application ID
//   GUILD_ID=...    optional. Set it to register to ONE server (updates instantly, good for testing).
//                   Leave it out to register GLOBALLY on every server the bot is in
//                   (can take a while to show up everywhere).

require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { commands } = require("./slashCommands");

const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!TOKEN || !CLIENT_ID) {
  console.error("Set TOKEN and CLIENT_ID in .env first.");
  process.exit(1);
}

const rest = new REST().setToken(TOKEN);

(async () => {
  try {
    const body = commands.map((c) => c.toJSON());
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) // one server
      : Routes.applicationCommands(CLIENT_ID); // every server
    const data = await rest.put(route, { body });
    const where = GUILD_ID ? `server ${GUILD_ID}` : "globally";
    console.log(`Registered ${data.length} command(s) ${where}: ${data.map((c) => "/" + c.name).join(", ")}`);
  } catch (err) {
    console.error("Failed to register commands:", err);
    process.exit(1);
  }
})();