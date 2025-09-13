import {
  type CryptoProvider,
  InvalidUUIDFormatError,
} from "@image-shield/core";

// Browser implementation needs to be async, but the interface is sync
// We'll create a wrapper that handles the async nature
export class BrowserCryptoProvider implements CryptoProvider {
  private static cachedKeys = new Map<string, CryptoKey>();

  encryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    throw new Error("Encrypt functionality not implemented for browser");
  }

  decryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    // This is a sync interface but Web Crypto API is async
    // We'll throw an error suggesting to use the async version
    throw new Error("Use decryptBufferAsync for browser implementation");
  }

  async decryptBufferAsync(
    buffer: Buffer,
    key: string,
    iv: Buffer,
  ): Promise<Buffer> {
    const keyBuffer = await this.keyTo32Async(key);

    // Convert Buffer to ArrayBuffer for Web Crypto API
    const dataArray = new Uint8Array(buffer);
    const keyArray = new Uint8Array(keyBuffer);
    const ivArray = new Uint8Array(iv);

    // Import key for AES-CBC (cache it for reuse)
    let cryptoKey = BrowserCryptoProvider.cachedKeys.get(key);
    if (!cryptoKey) {
      cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyArray,
        { name: "AES-CBC" },
        false,
        ["decrypt"],
      );
      BrowserCryptoProvider.cachedKeys.set(key, cryptoKey);
    }

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: ivArray,
      },
      cryptoKey,
      dataArray,
    );

    // Convert back to Buffer
    return Buffer.from(decryptedData);
  }

  keyTo32(key: string): Buffer {
    // For sync compatibility, we'll use a simple deterministic hash
    // In real usage, prefer keyTo32Async
    const encoder = new TextEncoder();
    const data = encoder.encode(key);

    // Simple deterministic hash for sync operation
    let hash = 0x9e3779b9; // Golden ratio hash constant
    for (let i = 0; i < data.length; i++) {
      hash ^= data[i];
      hash = (hash * 0x9e3779b9) >>> 0; // Ensure 32-bit unsigned
      hash ^= hash >>> 16;
    }

    // Create a 32-byte key using the hash as seed
    const result = new Uint8Array(32);
    let seed = hash;
    for (let i = 0; i < 32; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0; // LCG
      result[i] = (seed >>> 24) & 0xff;
    }

    return Buffer.from(result);
  }

  async keyTo32Async(key: string): Promise<Buffer> {
    // Proper async implementation using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Buffer.from(hashBuffer);
  }

  generateUUID(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback UUID generation
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  uuidToIV(uuid: string): Buffer {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32) {
      throw new InvalidUUIDFormatError("Invalid UUID format");
    }
    return Buffer.from(hex, "hex");
  }
}
