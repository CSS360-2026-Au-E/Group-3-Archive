import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { loadEvents } from "./helpers";
import path from "path";

const TOKEN = process.env.TOKEN;

const { Guilds, GuildMembers, GuildMessages, MessageContent } =
  GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember } = Partials;

const client = new Client({
  intents: [Guilds, GuildMembers, GuildMessages, MessageContent],
  partials: [User, Message, GuildMember, ThreadMember],
});

// Load messageLogger.js
const registerMessageLogger = require("./messageLogger");
// Load logCommand.js
const registerLogCommand = require("./logCommand");
// Register message logger system
registerMessageLogger(client, { logDir: "logs"});
// Register logger commands
registerLogCommand(client, { logDir: "logs"});

client.events = new Collection();

loadEvents(client, path.join(__dirname, "events"));

client.login(TOKEN);
