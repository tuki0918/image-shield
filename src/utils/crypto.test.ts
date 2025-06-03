import { CryptoUtils, uuidToIV } from "./crypto";

describe("CryptoUtils", () => {
  const key = "test-key-1234";
  const text = "Hello, world!";
  const buffer = Buffer.from("BufferData123");

  test("encryptBuffer/decryptBuffer", () => {
    const iv = Buffer.from("1234567890abcdef1234567890abcdef", "hex");
    const encrypted = CryptoUtils.encryptBuffer(buffer, key, iv);
    const decrypted = CryptoUtils.decryptBuffer(encrypted, key, iv);
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

  test("uuidToIV returns correct Buffer", () => {
    const uuid = "106e4326-1050-4e8a-850a-9e630f96de06";
    const iv = uuidToIV(uuid);
    expect(iv).toBeInstanceOf(Buffer);
    expect(iv.length).toBe(16);
    // check if the hex string
    expect(iv.toString("hex")).toBe("106e432610504e8a850a9e630f96de06");
  });
});
