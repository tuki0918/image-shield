/**
 * Browser stub for Node.js file system operations
 * This module provides no-op implementations to avoid import errors in browser builds
 */

export async function createDir(_dir: string, _recursive = false): Promise<void> {
  // No-op in browser environment
}

export async function writeFile(
  _dir: string,
  _filename: string,
  _data: string | Buffer,
): Promise<string> {
  // No-op in browser environment, return fake path
  return `${_dir}/${_filename}`;
}

export async function readJsonFile<T>(_filePath: string): Promise<T> {
  throw new Error('readJsonFile is not supported in browser environment');
}

export async function readFileBuffer(_filePath: string): Promise<Buffer> {
  throw new Error('readFileBuffer with file path is not supported in browser environment. Use BrowserFileHandler.readFileBuffer with File object instead.');
}

export function fileNameWithoutExtension(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  const fileName = lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}
