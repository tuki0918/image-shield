import { CryptoUtils, InvalidUUIDFormatError, uuidToIV } from "./crypto";

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

  test("uuidToIV returns correct Buffer", () => {
    const uuid = "106e4326-1050-4e8a-850a-9e630f96de06";
    const iv = uuidToIV(uuid);
    expect(iv).toBeInstanceOf(Buffer);
    expect(iv.length).toBe(16);
    // check if the hex string
    expect(iv.toString("hex")).toBe("106e432610504e8a850a9e630f96de06");
  });

  test("generateUUID returns correct UUID", () => {
    const uuid = CryptoUtils.generateUUID();
    expect(typeof uuid).toBe("string");
    expect(uuid.length).toBe(36);
    // check if the uuid is valid
    expect(
      uuid.match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      ),
    ).not.toBeNull();
  });

  test("uuidToIV throws error for invalid UUID", () => {
    const uuid = "106e4326-1050-4e8a-850a-9e630f96de06-invalid";
    expect(() => uuidToIV(uuid)).toThrow(InvalidUUIDFormatError);
  });
});
