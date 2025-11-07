#!/usr/bin/env node

import { Command } from "commander";
import { registerRestoreCommand } from "./commands/restore";
import { registerShuffleCommand } from "./commands/shuffle";

const program = new Command();

program
  .name("image-shield")
  .description("CLI tool for image fragmentation and restoration")
  .version("0.8.1");

// Register commands
registerShuffleCommand(program);
registerRestoreCommand(program);

// Error handling
program.on("command:*", () => {
  console.error("Invalid command. See --help for available commands.");
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}
