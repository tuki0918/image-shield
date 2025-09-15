import type { FragmentationConfig } from "@image-shield/core";
import ImageShield from "@image-shield/node";
import type { Command } from "commander";
import type { EncryptOptions } from "../types";
import { validateImagePaths, validateOutputDirectory } from "../validators";

/**
 * Configures and registers the encrypt command
 * @param program Commander program instance
 */
export function registerEncryptCommand(program: Command): void {
  program
    .command("encrypt")
    .description("Fragment images using shuffle-only mode")
    .argument("<images...>", "Input image file paths")
    .requiredOption("-o, --output <dir>", "Output directory")
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
    .action(handleEncryptCommand);
}

/**
 * Handles the encrypt command execution
 * @param images Array of image file paths
 * @param options Command options
 */
async function handleEncryptCommand(
  images: string[],
  options: EncryptOptions,
): Promise<void> {
  try {
    console.log("🔀 Starting image fragmentation...");

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
    });

    console.log(`✅ Images fragmented successfully to: ${outputDir}`);
  } catch (error) {
    console.error(
      `❌ Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
