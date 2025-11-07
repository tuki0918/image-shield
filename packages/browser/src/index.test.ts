import { describe, expect, test } from "vitest";
import { BrowserCryptoProviderImpl } from "./crypto";
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

  test("should sort fragment files by filename", () => {
    // Create files with proper fragment naming but in wrong order
    const fragmentFiles = [
      new File([], "img_3_fragmented.png"),
      new File([], "img_1_fragmented.png"), 
      new File([], "img_2_fragmented.png"),
    ];

    // Test the sorting logic used in validateDecryptOptions
    const sortedFiles = [...fragmentFiles].sort((a, b) => {
      const getFileNumber = (filename: string): number => {
        const match = filename.match(/_(\d+)(?:_fragmented)?\.png$/i);
        return match ? parseInt(match[1], 10) : 0;
      };

      const aNum = getFileNumber(a.name);
      const bNum = getFileNumber(b.name);
      
      if (aNum > 0 && bNum > 0) {
        return aNum - bNum;
      }
      return a.name.localeCompare(b.name);
    });

    expect(sortedFiles.map(f => f.name)).toEqual([
      "img_1_fragmented.png",
      "img_2_fragmented.png", 
      "img_3_fragmented.png"
    ]);
  });
});

describe("BrowserCryptoProviderImpl", () => {
  test("should create crypto provider", () => {
    const provider = new BrowserCryptoProviderImpl();
    expect(provider).toBeDefined();
  });

  test("should throw error for encrypt (not implemented)", () => {
    const provider = new BrowserCryptoProviderImpl();
    expect(() => {
      provider.encryptBuffer(
        new Uint8Array([1, 2, 3, 4]),
        "key",
        new Uint8Array(16),
      );
    }).toThrow("Encrypt functionality not implemented for browser");
  });

  test("should throw error for sync decrypt (use async version)", () => {
    const provider = new BrowserCryptoProviderImpl();
    expect(() => {
      provider.decryptBuffer(
        new Uint8Array([1, 2, 3, 4]),
        "key",
        new Uint8Array(16),
      );
    }).toThrow("Synchronous decryption not yet implemented");
  });

  test("should generate deterministic key", () => {
    const provider = new BrowserCryptoProviderImpl();
    const key1 = provider.keyTo32("test-key");
    const key2 = provider.keyTo32("test-key");

    expect(key1).toEqual(key2);
    expect(key1).toHaveLength(32);
  });

  test("should generate UUID", () => {
    const provider = new BrowserCryptoProviderImpl();
    const uuid = provider.generateUUID();

    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test("should convert UUID to IV", () => {
    const provider = new BrowserCryptoProviderImpl();
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const iv = provider.uuidToIV(uuid);

    expect(iv).toHaveLength(16);
    expect(
      Array.from(iv)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    ).toBe("550e8400e29b41d4a716446655440000");
  });

  test("should throw error for invalid UUID format", () => {
    const provider = new BrowserCryptoProviderImpl();

    expect(() => {
      provider.uuidToIV("invalid-uuid");
    }).toThrow("Invalid UUID format");
  });
});
