export class InvalidUUIDFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidUUIDFormatError";
  }
}

export interface CryptoProvider {
  encryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer;
  decryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer;
  keyTo32(key: string): Buffer;
  generateUUID(): string;
  uuidToIV(uuid: string): Buffer;
}

// biome-ignore lint/complexity/noStaticOnlyClass:
export class CryptoUtils {
  private static provider: CryptoProvider | null = null;

  static setProvider(provider: CryptoProvider): void {
    CryptoUtils.provider = provider;
  }

  static getProvider(): CryptoProvider {
    if (!CryptoUtils.provider) {
      throw new Error("Crypto provider not set. Call CryptoUtils.setProvider() first.");
    }
    return CryptoUtils.provider;
  }

  static encryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    return CryptoUtils.getProvider().encryptBuffer(buffer, key, iv);
  }

  static decryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer {
    return CryptoUtils.getProvider().decryptBuffer(buffer, key, iv);
  }

  static keyTo32(key: string): Buffer {
    return CryptoUtils.getProvider().keyTo32(key);
  }

  static generateUUID(): string {
    return CryptoUtils.getProvider().generateUUID();
  }

  static uuidToIV(uuid: string): Buffer {
    return CryptoUtils.getProvider().uuidToIV(uuid);
  }
}