import { CryptoUtils, uuidToIV } from "./crypto";

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

  test("encryptBuffer/decryptBuffer with IV", () => {
    const iv = Buffer.from("1234567890abcdef1234567890abcdef", "hex");
    const encrypted = CryptoUtils.encryptBuffer(buffer, key, iv);
    const decrypted = CryptoUtils.decryptBuffer(encrypted, key, iv);
    expect(decrypted.equals(buffer)).toBe(true);
  });

  test("encryptBlocks/decryptBlocks", () => {
    const buffers = [
      Buffer.from("Block1"),
      Buffer.from("Block2"),
      Buffer.from("Block3"),
    ];
    const encrypted = CryptoUtils.encryptBlocks(buffers, key);
    expect(Array.isArray(encrypted)).toBe(true);
    expect(encrypted.length).toBe(buffers.length);
    const decrypted = CryptoUtils.decryptBlocks(encrypted, key);
    expect(Array.isArray(decrypted)).toBe(true);
    expect(decrypted.length).toBe(buffers.length);
    for (let i = 0; i < buffers.length; i++) {
      expect(decrypted[i].equals(buffers[i])).toBe(true);
    }
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

  test("uuidToIV returns correct Buffer", () => {
    const uuid = "106e4326-1050-4e8a-850a-9e630f96de06";
    const iv = uuidToIV(uuid);
    expect(iv).toBeInstanceOf(Buffer);
    expect(iv.length).toBe(16);
    // check if the hex string
    expect(iv.toString("hex")).toBe("106e432610504e8a850a9e630f96de06");
  });
});
