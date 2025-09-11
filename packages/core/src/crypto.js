export class InvalidUUIDFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidUUIDFormatError";
  }
}
// biome-ignore lint/complexity/noStaticOnlyClass:
export class CryptoUtils {
  static provider = null;
  static setProvider(provider) {
    CryptoUtils.provider = provider;
  }
  static getProvider() {
    if (!CryptoUtils.provider) {
      throw new Error(
        "Crypto provider not set. Call CryptoUtils.setProvider() first.",
      );
    }
    return CryptoUtils.provider;
  }
  static encryptBuffer(buffer, key, iv) {
    return CryptoUtils.getProvider().encryptBuffer(buffer, key, iv);
  }
  static decryptBuffer(buffer, key, iv) {
    return CryptoUtils.getProvider().decryptBuffer(buffer, key, iv);
  }
  static keyTo32(key) {
    return CryptoUtils.getProvider().keyTo32(key);
  }
  static generateUUID() {
    return CryptoUtils.getProvider().generateUUID();
  }
  static uuidToIV(uuid) {
    return CryptoUtils.getProvider().uuidToIV(uuid);
  }
}
//# sourceMappingURL=crypto.js.map
