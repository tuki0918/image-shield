import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Create a directory
 * @param dir Directory path
 * @param recursive Create parent directories if they don't exist
 */
export async function createDir(dir: string, recursive = false) {
  await fs.mkdir(dir, { recursive });
}

/**
 * Write a file
 * @param dir Directory path
 * @param filename Filename
 * @param data Data to write
 * @returns Path to the file
 */
export async function writeFile(
  dir: string,
  filename: string,
  data: string | Uint8Array,
) {
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, data);
  return filePath;
}

/**
 * Read a JSON file and return its content
 * @param filePath Path to the JSON file
 * @returns Content of the JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

/**
 * Read a file and return its content
 * @param filePath Path to the file
 * @returns Content of the file
 */
export async function readFileBuffer(filePath: string): Promise<Uint8Array> {
  return await fs.readFile(filePath);
}
