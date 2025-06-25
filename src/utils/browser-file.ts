/**
 * Browser-compatible file operations using File API
 */

export class BrowserFileHandler {
  /**
   * Read a File object as ArrayBuffer
   */
  static async readFile(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Read a File object as Buffer (for compatibility)
   */
  static async readFileBuffer(file: File): Promise<Buffer> {
    const arrayBuffer = await this.readFile(file);
    return Buffer.from(arrayBuffer);
  }

  /**
   * Create a download link for a Blob
   */
  static async downloadBlob(blob: Blob, filename: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Create Object URL from Blob
   */
  static createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * Revoke Object URL
   */
  static revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  }

  /**
   * Convert ArrayBuffer to Blob
   */
  static arrayBufferToBlob(buffer: ArrayBuffer, mimeType = 'application/octet-stream'): Blob {
    return new Blob([buffer], { type: mimeType });
  }

  /**
   * Create a PNG Blob from Buffer
   */
  static bufferToPngBlob(buffer: Buffer): Blob {
    return new Blob([buffer], { type: 'image/png' });
  }
}

/**
 * Browser-compatible path operations
 */
export class BrowserPath {
  /**
   * Get file name from a file path or File object
   */
  static basename(pathOrFile: string | File): string {
    if (pathOrFile instanceof File) {
      return pathOrFile.name;
    }
    return pathOrFile.split('/').pop() || pathOrFile;
  }

  /**
   * Get file extension
   */
  static extname(pathOrFile: string | File): string {
    const name = pathOrFile instanceof File ? pathOrFile.name : pathOrFile;
    const lastDot = name.lastIndexOf('.');
    return lastDot > 0 ? name.substring(lastDot) : '';
  }

  /**
   * Get file name without extension
   */
  static basenameWithoutExtension(pathOrFile: string | File): string {
    const name = this.basename(pathOrFile);
    const ext = this.extname(name);
    return ext ? name.substring(0, name.length - ext.length) : name;
  }

  /**
   * Join path segments (browser-compatible)
   */
  static join(...segments: string[]): string {
    return segments
      .filter(segment => segment)
      .join('/')
      .replace(/\/+/g, '/');
  }

  /**
   * Get file name without extension (browser-compatible)
   */
  static fileNameWithoutExtension(pathOrFile: string | File): string {
    const name = this.basename(pathOrFile);
    const ext = this.extname(name);
    return ext ? name.substring(0, name.length - ext.length) : name;
  }
}
