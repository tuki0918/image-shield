import crypto from "node:crypto";

// biome-ignore lint/complexity/noStaticOnlyClass:
export class CryptoUtils {
  static encryptBuffer(buffer: Buffer, key: string, iv?: Buffer): Buffer {
    const ivBuf = iv ?? Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      CryptoUtils.keyTo32(key),
      ivBuf,
    );
    return Buffer.concat([cipher.update(buffer), cipher.final()]);
  }

  static decryptBuffer(buffer: Buffer, key: string, iv?: Buffer): Buffer {
    const ivBuf = iv ?? Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      CryptoUtils.keyTo32(key),
      ivBuf,
    );
    return Buffer.concat([decipher.update(buffer), decipher.final()]);
  }

  static keyTo32(key: string): Buffer {
    return crypto.createHash("sha256").update(key).digest();
  }

  static generateSeed(): number {
    return Math.floor(Math.random() * 1000000);
  }
}

// Convert UUID to IV (16 bytes)
export function uuidToIV(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error("Invalid UUID format");
  return Buffer.from(hex, "hex");
}
