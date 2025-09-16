/**
 * Browser-compatible file utilities
 */

/**
 * Read JSON data from a File or text blob
 * @param file File or Blob containing JSON data
 * @returns Promise resolving to parsed JSON data
 */
export async function readJsonFile<T>(file: File | Blob): Promise<T> {
  const text = await file.text();
  return JSON.parse(text);
}

/**
 * Create a downloadable file blob
 * @param data Data to include in the file (string, Uint8Array, or Blob)
 * @param filename Suggested filename
 * @param mimeType MIME type of the file
 * @returns File object
 */
export function createFile(
  data: string | Uint8Array | Blob,
  filename: string,
  mimeType = "application/octet-stream",
): File {
  let blob: Blob;

  if (data instanceof Blob) {
    blob = data;
  } else if (typeof data === "string") {
    blob = new Blob([data], { type: mimeType });
  } else {
    blob = new Blob([data], { type: mimeType });
  }

  return new File([blob], filename, { type: mimeType });
}

/**
 * Download a file in the browser
 * @param file File or Blob to download
 * @param filename Filename for the download
 */
export function downloadFile(file: File | Blob, filename?: string): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || (file instanceof File ? file.name : "download");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get the filename without extension
 * @param filename Filename with extension
 * @returns Filename without extension
 */
export function fileNameWithoutExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  return lastDotIndex === -1 ? filename : filename.slice(0, lastDotIndex);
}

/**
 * Convert File or Blob to ArrayBuffer
 * @param file File or Blob
 * @returns Promise resolving to ArrayBuffer
 */
export async function fileToArrayBuffer(
  file: File | Blob,
): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

/**
 * Convert File or Blob to Uint8Array
 * @param file File or Blob
 * @returns Promise resolving to Uint8Array
 */
export async function fileToUint8Array(file: File | Blob): Promise<Uint8Array> {
  const arrayBuffer = await fileToArrayBuffer(file);
  return new Uint8Array(arrayBuffer);
}
