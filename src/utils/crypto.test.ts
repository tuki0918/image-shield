import { CryptoUtils } from "./crypto";

describe("CryptoUtils", () => {
  const key = "test-key-1234";
  const text = "Hello, world!";
  const buffer = Buffer.from("BufferData123");

  test("encrypt/decrypt string", () => {
    const encrypted = CryptoUtils.encrypt(text, key);
    const decrypted = CryptoUtils.decrypt(encrypted, key);
    expect(decrypted).toBe(text);
  });

  test("encryptBlock/decryptBlock", () => {
    const encrypted = CryptoUtils.encryptBlock(buffer, key);
    const decrypted = CryptoUtils.decryptBlock(encrypted, key);
    expect(decrypted.equals(buffer)).toBe(true);
  });

  test("encryptBuffer/decryptBuffer", () => {
    const encrypted = CryptoUtils.encryptBuffer(buffer, key);
    const decrypted = CryptoUtils.decryptBuffer(encrypted, key);
    expect(decrypted.equals(buffer)).toBe(true);
  });

  test("keyTo32 returns 32 bytes", () => {
    const result = CryptoUtils.keyTo32(key);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBe(32);
  });

  test("generateSeed returns number", () => {
    const seed = CryptoUtils.generateSeed();
    expect(typeof seed).toBe("number");
    expect(Number.isInteger(seed)).toBe(true);
  });
});
