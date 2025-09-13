#!/usr/bin/env node

import { Command } from "commander";
import { registerDecryptCommand } from "./commands/decrypt";
import { registerEncryptCommand } from "./commands/encrypt";

const program = new Command();

program
  .name("image-shield")
  .description("CLI tool for image fragmentation and restoration")
  .version("0.8.1");

// Register commands
registerEncryptCommand(program);
registerDecryptCommand(program);

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
