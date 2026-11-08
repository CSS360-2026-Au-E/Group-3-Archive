import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import { loadEvents } from "./helpers";
import path from "path";

import registerMessageLogger from "./logsys/messageLogger.js";
import createLogStore from "./logsys/logStore.js";
import { registerSlashCommands } from "./slashCommands.js";

const TOKEN = process.env.TOKEN;

const { Guilds, GuildMembers, GuildMessages, MessageContent } = GatewayIntentBits;
const { User, Message, GuildMember, ThreadMember } = Partials;

const client = new Client({
  intents: [Guilds, GuildMembers, GuildMessages, MessageContent],
  partials: [User, Message, GuildMember, ThreadMember],
});

// Log store options before init
const LOG_OPTIONS = { logDir: path.join(__dirname, "..", "logs"), splitByChannel: true };

const store = createLogStore(LOG_OPTIONS); 	// Access log store      
registerMessageLogger(client, LOG_OPTIONS);	// Register message logging system
registerSlashCommands(client, store);      	// Register commands   

client.events = new Collection();

loadEvents(client, path.join(__dirname, "events"));

client.login(TOKEN);
