export declare class InvalidUUIDFormatError extends Error {
  constructor(message: string);
}
export interface CryptoProvider {
  encryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer;
  decryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer;
  keyTo32(key: string): Buffer;
  generateUUID(): string;
  uuidToIV(uuid: string): Buffer;
}
export declare class CryptoUtils {
  private static provider;
  static setProvider(provider: CryptoProvider): void;
  static getProvider(): CryptoProvider;
  static encryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer;
  static decryptBuffer(buffer: Buffer, key: string, iv: Buffer): Buffer;
  static keyTo32(key: string): Buffer;
  static generateUUID(): string;
  static uuidToIV(uuid: string): Buffer;
}
//# sourceMappingURL=crypto.d.ts.map
