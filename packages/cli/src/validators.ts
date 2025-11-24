import { existsSync, lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Validates an array of image file paths
 * @param paths Array of file paths to validate
 * @returns Array of resolved absolute paths
 */
export function validateImagePaths(paths: string[]): string[] {
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

/**
 * Validates output directory path
 * @param outputPath Output directory path
 * @returns Resolved absolute path
 */
export function validateOutputDirectory(outputPath: string): string {
  const resolvedPath = resolve(outputPath);

  // Create parent directory if it doesn't exist
  const parentDir = dirname(resolvedPath);
  if (!existsSync(parentDir)) {
    console.error(`Error: Parent directory does not exist: ${parentDir}`);
    process.exit(1);
  }

  return resolvedPath;
}

/**
 * Validates manifest file path
 * @param manifestPath Path to manifest file
 * @returns Resolved absolute path
 */
export function validateManifestPath(manifestPath: string): string {
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
