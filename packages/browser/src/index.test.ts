import { describe, expect, test } from "vitest";
import { BrowserCryptoProvider } from "./crypto";
import BrowserImageShield from "./index";

describe("BrowserImageShield", () => {
  test("should export main class and types", () => {
    expect(BrowserImageShield).toBeDefined();
    expect(typeof BrowserImageShield.decrypt).toBe("function");
    expect(typeof BrowserImageShield.decryptToBlobs).toBe("function");
  });

  test("should validate decrypt options", async () => {
    await expect(
      BrowserImageShield.decrypt({
        imageFiles: [],
        manifestFile: new File([], "manifest.json"),
      }),
    ).rejects.toThrow("imageFiles cannot be empty");

    await expect(
      BrowserImageShield.decrypt({
        imageFiles: ["not a file"] as unknown as File[],
        manifestFile: new File([], "manifest.json"),
      }),
    ).rejects.toThrow("imageFiles[0] must be a File object");

    await expect(
      BrowserImageShield.decrypt({
        imageFiles: [new File([], "test.png")],
        manifestFile: "not a file" as unknown as File,
      }),
    ).rejects.toThrow("manifestFile must be a File object");
  });
});

describe("BrowserCryptoProvider", () => {
  test("should create crypto provider", () => {
    const provider = new BrowserCryptoProvider();
    expect(provider).toBeDefined();
  });

  test("should throw error for encrypt (not implemented)", () => {
    const provider = new BrowserCryptoProvider();
    expect(() => {
      provider.encryptBuffer(
        Buffer.from("test"),
        "key",
        Buffer.from("iv123456789abcde"),
      );
    }).toThrow("Encrypt functionality not implemented for browser");
  });

  test("should throw error for sync decrypt (use async version)", () => {
    const provider = new BrowserCryptoProvider();
    expect(() => {
      provider.decryptBuffer(
        Buffer.from("test"),
        "key",
        Buffer.from("iv123456789abcde"),
      );
    }).toThrow("Use decryptBufferAsync for browser implementation");
  });

  test("should generate deterministic key", () => {
    const provider = new BrowserCryptoProvider();
    const key1 = provider.keyTo32("test-key");
    const key2 = provider.keyTo32("test-key");

    expect(key1).toEqual(key2);
    expect(key1).toHaveLength(32);
  });

  test("should generate UUID", () => {
    const provider = new BrowserCryptoProvider();
    const uuid = provider.generateUUID();

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test("should convert UUID to IV", () => {
    const provider = new BrowserCryptoProvider();
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const iv = provider.uuidToIV(uuid);

    expect(iv).toHaveLength(16);
    expect(iv.toString("hex")).toBe("550e8400e29b41d4a716446655440000");
  });

  test("should throw error for invalid UUID format", () => {
    const provider = new BrowserCryptoProvider();

    expect(() => {
      provider.uuidToIV("invalid-uuid");
    }).toThrow("Invalid UUID format");
  });
});
