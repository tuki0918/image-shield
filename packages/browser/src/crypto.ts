import {
  type CryptoProvider,
  InvalidUUIDFormatError,
} from "@image-shield/core";

// Browser-specific crypto provider interface using browser-native types
export interface BrowserCryptoProvider
  extends Omit<
    CryptoProvider,
    "encryptBuffer" | "decryptBuffer" | "keyTo32" | "uuidToIV"
  > {
  encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array;
  decryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array;
  decryptBufferAsync(
    buffer: Uint8Array,
    key: string,
    iv: Uint8Array,
  ): Promise<Uint8Array>;
  keyTo32(key: string): Uint8Array;
  keyTo32Async(key: string): Promise<Uint8Array>;
  uuidToIV(uuid: string): Uint8Array;
}

// Browser implementation needs to be async, but the interface is sync
// We'll create a wrapper that handles the async nature
export class BrowserCryptoProviderImpl implements BrowserCryptoProvider {
  private static cachedKeys = new Map<string, CryptoKey>();

  encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array {
    throw new Error("Encrypt functionality not implemented for browser");
  }

  decryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array {
    // This is a sync interface but Web Crypto API is async
    // We'll throw an error suggesting to use the async version
    throw new Error("Use decryptBufferAsync for browser implementation");
  }

  async decryptBufferAsync(
    buffer: Uint8Array,
    key: string,
    iv: Uint8Array,
  ): Promise<Uint8Array> {
    const keyBuffer = await this.keyTo32Async(key);

    // Import key for AES-CBC (cache it for reuse)
    let cryptoKey = BrowserCryptoProviderImpl.cachedKeys.get(key);
    if (!cryptoKey) {
      cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-CBC" },
        false,
        ["decrypt"],
      );
      BrowserCryptoProviderImpl.cachedKeys.set(key, cryptoKey);
    }

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      cryptoKey,
      buffer,
    );

    // Convert back to Uint8Array
    return new Uint8Array(decryptedData);
  }

  keyTo32(key: string): Uint8Array {
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

    return result;
  }

  async keyTo32Async(key: string): Promise<Uint8Array> {
    // Proper async implementation using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
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

  uuidToIV(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32) {
      throw new InvalidUUIDFormatError("Invalid UUID format");
    }

    // Convert hex string to Uint8Array
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      result[i] = Number.parseInt(hex.substr(i * 2, 2), 16);
    }
    return result;
  }
}
