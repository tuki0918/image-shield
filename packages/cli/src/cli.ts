#!/usr/bin/env node

import { existsSync, lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { FragmentationConfig } from "@image-shield/core";
import ImageShield from "@image-shield/node";
import { Command } from "commander";

// Type definitions for command options
interface EncryptOptions {
  output: string;
  key?: string;
  blockSize?: number;
  prefix?: string;
  seed?: number;
  restoreFilename?: boolean;
}

interface DecryptOptions {
  manifest: string;
  output: string;
  key?: string;
}

const program = new Command();

program
  .name("image-shield")
  .description("CLI tool for image fragmentation and restoration")
  .version("0.8.1");

// Utility functions
function validateImagePaths(paths: string[]): string[] {
  const resolvedPaths: string[] = [];

  for (const path of paths) {
    const resolvedPath = resolve(path);

    if (!existsSync(resolvedPath)) {
      console.error(`Error: File not found: ${path}`);
      process.exit(1);
    }

    if (!lstatSync(resolvedPath).isFile()) {
      console.error(`Error: Not a file: ${path}`);
      process.exit(1);
    }

    resolvedPaths.push(resolvedPath);
  }

  return resolvedPaths;
}

function validateOutputDirectory(outputPath: string): string {
  const resolvedPath = resolve(outputPath);

  // Create parent directory if it doesn't exist
  const parentDir = dirname(resolvedPath);
  if (!existsSync(parentDir)) {
    console.error(`Error: Parent directory does not exist: ${parentDir}`);
    process.exit(1);
  }

  return resolvedPath;
}

function validateManifestPath(manifestPath: string): string {
  const resolvedPath = resolve(manifestPath);

  if (!existsSync(resolvedPath)) {
    console.error(`Error: Manifest file not found: ${manifestPath}`);
    process.exit(1);
  }

  if (!lstatSync(resolvedPath).isFile()) {
    console.error(`Error: Manifest path is not a file: ${manifestPath}`);
    process.exit(1);
  }

  return resolvedPath;
}

// Encrypt command
program
  .command("encrypt")
  .description("Fragment and encrypt images")
  .argument("<images...>", "Input image file paths")
  .requiredOption("-o, --output <dir>", "Output directory")
  .option("-k, --key <key>", "Secret key for encryption")
  .option("-b, --block-size <size>", "Pixel block size", (value: string) => {
    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num) || num <= 0) {
      throw new Error("Block size must be a positive integer");
    }
    return num;
  })
  .option("-p, --prefix <prefix>", "Prefix for fragment files")
  .option("-s, --seed <seed>", "Random seed", (value: string) => {
    const num = Number.parseInt(value, 10);
    if (Number.isNaN(num)) {
      throw new Error("Seed must be an integer");
    }
    return num;
  })
  .option("--restore-filename", "Restore original file names")
  .action(async (images: string[], options: EncryptOptions) => {
    try {
      console.log("🔐 Starting image encryption...");

      const imagePaths = validateImagePaths(images);
      const outputDir = validateOutputDirectory(options.output);

      const config: FragmentationConfig = {};
      if (options.blockSize !== undefined) config.blockSize = options.blockSize;
      if (options.prefix !== undefined) config.prefix = options.prefix;
      if (options.seed !== undefined) config.seed = options.seed;
      if (options.restoreFilename) config.restoreFileName = true;

      await ImageShield.encrypt({
        imagePaths,
        outputDir,
        config: Object.keys(config).length > 0 ? config : undefined,
        secretKey: options.key,
      });

      console.log(`✅ Images encrypted successfully to: ${outputDir}`);
    } catch (error) {
      console.error(
        `❌ Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

// Decrypt command
program
  .command("decrypt")
  .description("Restore fragmented images")
  .argument("<fragments...>", "Fragment file paths")
  .requiredOption("-m, --manifest <path>", "Manifest file path")
  .requiredOption("-o, --output <dir>", "Output directory")
  .option("-k, --key <key>", "Secret key for decryption")
  .action(async (fragments: string[], options: DecryptOptions) => {
    try {
      console.log("🔓 Starting image decryption...");

      const imagePaths = validateImagePaths(fragments);
      const manifestPath = validateManifestPath(options.manifest);
      const outputDir = validateOutputDirectory(options.output);

      await ImageShield.decrypt({
        imagePaths,
        manifestPath,
        outputDir,
        secretKey: options.key,
      });

      console.log(`✅ Images restored successfully to: ${outputDir}`);
    } catch (error) {
      console.error(
        `❌ Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exit(1);
    }
  });

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
