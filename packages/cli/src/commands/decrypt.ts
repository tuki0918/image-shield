import ImageShield from "@image-shield/node";
import type { Command } from "commander";
import type { DecryptOptions } from "../types";
import {
  validateImagePaths,
  validateManifestPath,
  validateOutputDirectory,
} from "../validators";

/**
 * Configures and registers the decrypt command
 * @param program Commander program instance
 */
export function registerDecryptCommand(program: Command): void {
  program
    .command("decrypt")
    .description("Restore fragmented images")
    .argument("<fragments...>", "Fragment file paths")
    .requiredOption("-m, --manifest <path>", "Manifest file path")
    .requiredOption("-o, --output <dir>", "Output directory")
    .action(handleDecryptCommand);
}

/**
 * Handles the decrypt command execution
 * @param fragments Array of fragment file paths
 * @param options Command options
 */
async function handleDecryptCommand(
  fragments: string[],
  options: DecryptOptions,
): Promise<void> {
  try {
    console.log("🔄 Starting image restoration...");

    const imagePaths = validateImagePaths(fragments);
    const manifestPath = validateManifestPath(options.manifest);
    const outputDir = validateOutputDirectory(options.output);

    await ImageShield.decrypt({
      imagePaths,
      manifestPath,
      outputDir,
    });

    console.log(`✅ Images restored successfully to: ${outputDir}`);
  } catch (error) {
    console.error(
      `❌ Restoration failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
