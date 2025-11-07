import ImageShield from "@image-shield/node";
import type { Command } from "commander";
import type { RestoreOptions } from "../types";
import {
  validateImagePaths,
  validateManifestPath,
  validateOutputDirectory,
} from "../validators";

/**
 * Configures and registers the restore command
 * @param program Commander program instance
 */
export function registerRestoreCommand(program: Command): void {
  program
    .command("restore")
    .description("Restore fragmented images")
    .argument("<fragments...>", "Fragment file paths")
    .requiredOption("-m, --manifest <path>", "Manifest file path")
    .requiredOption("-o, --output <dir>", "Output directory")
    .action(handleRestoreCommand);
}

/**
 * Handles the restore command execution
 * @param fragments Array of fragment file paths
 * @param options Command options
 */
async function handleRestoreCommand(
  fragments: string[],
  options: RestoreOptions,
): Promise<void> {
  try {
    console.log("🔀 Starting image restoration...");

    const imagePaths = validateImagePaths(fragments);
    const manifestPath = validateManifestPath(options.manifest);
    const outputDir = validateOutputDirectory(options.output);

    await ImageShield.restore({
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
