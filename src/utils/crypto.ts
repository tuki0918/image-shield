import crypto from "node:crypto";

export class InvalidUUIDFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUUIDFormatError";
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass:
export class CryptoUtils {
  static encryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      CryptoUtils.keyTo32(key),
      iv,
    );
    return Buffer.concat([cipher.update(buffer), cipher.final()]);
  }

  static decryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      CryptoUtils.keyTo32(key),
      iv,
    );
    return Buffer.concat([decipher.update(buffer), decipher.final()]);
  }

  static keyTo32(key: string): Buffer {
    return crypto.createHash("sha256").update(key).digest();
  }

  static generateUUID(): string {
    return crypto.randomUUID();
  }
}

// Convert UUID to IV (16 bytes)
export function uuidToIV(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32)
    throw new InvalidUUIDFormatError("Invalid UUID format");
  return Buffer.from(hex, "hex");
}
