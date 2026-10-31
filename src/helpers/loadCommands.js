import loadFiles from "./loadFiles";
import path from "path";

// Reads every file in src/commands and stores it in client.commands,
// keyed by the command name (e.g. "summarize").
export default function loadCommands(client, dirName) {
  client.commands.clear();

  for (const file of loadFiles(dirName, ".js")) {
    const command = require(path.join(dirName, file)).default;
    client.commands.set(command.data.name, command);
  }

  console.log(`Loaded commands: ${[...client.commands.keys()].join(", ")}`);
}