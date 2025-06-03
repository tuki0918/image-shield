import crypto from "node:crypto";

// biome-ignore lint/complexity/noStaticOnlyClass:
export class CryptoUtils {
  // Encrypt a string with AES-256-CBC (Base64 output)
  static encrypt(data: string, key: string): string {
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv(
      "aes-256-cbc",
      CryptoUtils.keyTo32(key),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(data, "utf8"),
      cipher.final(),
    ]);
    return encrypted.toString("base64");
  }

  // Decrypt a string with AES-256-CBC
  static decrypt(encryptedData: string, key: string): string {
    const iv = Buffer.alloc(16, 0);
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      CryptoUtils.keyTo32(key),
      iv,
    );
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedData, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  }

  // Buffer → Base64 → AES encryption
  static encryptBlock(data: Buffer, key: string): string {
    const base64 = data.toString("base64");
    return CryptoUtils.encrypt(base64, key);
  }

  // AES decryption → Base64 → Buffer
  static decryptBlock(encrypted: string, key: string): Buffer {
    const base64 = CryptoUtils.decrypt(encrypted, key);
    return Buffer.from(base64, "base64");
  }

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

  // Encrypt multiple blocks
  static encryptBlocks(blocks: Buffer[], key: string): string[] {
    return blocks.map((block) => CryptoUtils.encryptBlock(block, key));
  }

  // Decrypt multiple blocks
  static decryptBlocks(blocks: string[], key: string): Buffer[] {
    return blocks.map((block) => CryptoUtils.decryptBlock(block, key));
  }
}

// クラス外で定義
export function uuidToIV(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  if (hex.length !== 32) throw new Error("Invalid UUID format");
  return Buffer.from(hex, "hex");
}
