import crypto from "node:crypto";
import {
  type CryptoProvider,
  InvalidUUIDFormatError,
} from "@image-shield/core";

export class NodeCryptoProvider implements CryptoProvider {
  encryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    const cipher = crypto.createCipheriv("aes-256-cbc", this.keyTo32(key), iv);
    return Buffer.concat([cipher.update(buffer), cipher.final()]);
  }

  decryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      this.keyTo32(key),
      iv,
    );
    return Buffer.concat([decipher.update(buffer), decipher.final()]);
  }

  keyTo32(key: string): Buffer {
    return crypto.createHash("sha256").update(key).digest();
  }

  generateUUID(): string {
    return crypto.randomUUID();
  }

  uuidToIV(uuid: string): Buffer {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32)
      throw new InvalidUUIDFormatError("Invalid UUID format");
    return Buffer.from(hex, "hex");
  }
}
