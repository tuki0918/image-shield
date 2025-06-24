import { CryptoUtils, InvalidUUIDFormatError } from "./crypto";

describe("CryptoUtils", () => {
  const key = "test-key-1234";
  const buffer = new Uint8Array([66, 117, 102, 102, 101, 114, 68, 97, 116, 97, 49, 50, 51]); // "BufferData123"

  test("encryptBuffer/decryptBuffer", async () => {
    const iv = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef]);
    const encrypted = await CryptoUtils.encryptBuffer(buffer, key, iv);
    const decrypted = await CryptoUtils.decryptBuffer(encrypted, key, iv);
    expect(Array.from(decrypted)).toEqual(Array.from(buffer));
  });

  test("keyTo32 returns 32 bytes", async () => {
    const result = await CryptoUtils.keyTo32(key);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(32);
  });

  test("uuidToIV returns correct Uint8Array", () => {
    const uuid = "106e4326-1050-4e8a-850a-9e630f96de06";
    const iv = CryptoUtils.uuidToIV(uuid);
    expect(iv).toBeInstanceOf(Uint8Array);
    expect(iv.length).toBe(16);
    // check if the hex values are correct
    const expected = new Uint8Array([0x10, 0x6e, 0x43, 0x26, 0x10, 0x50, 0x4e, 0x8a, 0x85, 0x0a, 0x9e, 0x63, 0x0f, 0x96, 0xde, 0x06]);
    expect(Array.from(iv)).toEqual(Array.from(expected));
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
    expect(() => CryptoUtils.uuidToIV(uuid)).toThrow(InvalidUUIDFormatError);
  });
});
