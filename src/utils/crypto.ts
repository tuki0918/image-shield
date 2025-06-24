// Web Crypto API implementation for cross-platform compatibility
// Works in both Node.js (15.6.0+) and browsers

export class InvalidUUIDFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUUIDFormatError";
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass:
export class CryptoUtils {
  static async encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await this.importKey(await this.keyTo32(key));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      buffer
    );
    return new Uint8Array(encrypted);
  }

  static async decryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Promise<Uint8Array> {
    const cryptoKey = await this.importKey(await this.keyTo32(key));
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv },
      cryptoKey,
      buffer
    );
    return new Uint8Array(decrypted);
  }

  static async keyTo32(key: string): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hash);
  }

  static generateUUID(): string {
    return crypto.randomUUID();
  }

  static uuidToIV(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32)
      throw new InvalidUUIDFormatError("Invalid UUID format");
    return new Uint8Array(hex.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
  }

  private static async importKey(keyData: Uint8Array): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"]
    );
  }
}
