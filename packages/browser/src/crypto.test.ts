import { describe, expect, test } from "vitest";
import { BrowserCryptoProviderImpl } from "./crypto";

describe("BrowserCryptoProvider Encryption/Decryption", () => {
  test("keyTo32 should produce consistent keys", () => {
    const provider = new BrowserCryptoProviderImpl();
    const key1 = provider.keyTo32("test-key");
    const key2 = provider.keyTo32("test-key");
    
    expect(key1).toEqual(key2);
    expect(key1).toHaveLength(32);
    
    // Different keys should produce different results
    const key3 = provider.keyTo32("different-key");
    expect(key1).not.toEqual(key3);
  });

  test("uuidToIV should produce consistent IVs", () => {
    const provider = new BrowserCryptoProviderImpl();
    const testUuid = "550e8400-e29b-41d4-a716-446655440000";
    
    const iv1 = provider.uuidToIV(testUuid);
    const iv2 = provider.uuidToIV(testUuid);
    
    expect(iv1).toEqual(iv2);
    expect(iv1).toHaveLength(16);
  });

  test("keyTo32 should match Node.js implementation format", () => {
    const provider = new BrowserCryptoProviderImpl();
    
    // Test with known key to verify SHA-256 compatibility
    const key = provider.keyTo32("test");
    
    // The key should be exactly 32 bytes
    expect(key).toHaveLength(32);
    
    // Verify it's deterministic
    const key2 = provider.keyTo32("test");
    expect(key).toEqual(key2);
    
    // Known SHA-256 of "test" should be: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
    const expectedBytes = [
      0x9f, 0x86, 0xd0, 0x81, 0x88, 0x4c, 0x7d, 0x65, 
      0x9a, 0x2f, 0xea, 0xa0, 0xc5, 0x5a, 0xd0, 0x15, 
      0xa3, 0xbf, 0x4f, 0x1b, 0x2b, 0x0b, 0x82, 0x2c, 
      0xd1, 0x5d, 0x6c, 0x15, 0xb0, 0xf0, 0x0a, 0x08
    ];
    
    expect(Array.from(key)).toEqual(expectedBytes);
  });

  test("decryptBufferAsync should work with Web Crypto API", async () => {
    const provider = new BrowserCryptoProviderImpl();
    
    // Test data
    const plaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const key = "test-key";
    const testUuid = "550e8400-e29b-41d4-a716-446655440000";
    const iv = provider.uuidToIV(testUuid);
    
    // First, let's manually encrypt using Web Crypto API to test decryption
    const keyBuffer = provider.keyTo32(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"]
    );
    
    // Encrypt the plaintext
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      cryptoKey,
      plaintext
    );
    
    // Now decrypt using our implementation
    const decrypted = await provider.decryptBufferAsync(
      new Uint8Array(encrypted),
      key,
      iv
    );
    
    expect(decrypted).toEqual(plaintext);
  });

  test("crypto provider should be compatible with itself", async () => {
    const provider = new BrowserCryptoProviderImpl();
    
    // Test larger data block
    const testData = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      testData[i] = i % 256;
    }
    
    const key = "my-secret-key";
    const testUuid = "123e4567-e89b-12d3-a456-426614174000";
    const iv = provider.uuidToIV(testUuid);
    
    // Manually encrypt
    const keyBuffer = provider.keyTo32(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBuffer,
      { name: "AES-CBC" },
      false,
      ["encrypt", "decrypt"]
    );
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      cryptoKey,
      testData
    );
    
    // Decrypt using our method
    const decrypted = await provider.decryptBufferAsync(
      new Uint8Array(encrypted),
      key,
      iv
    );
    
    expect(decrypted).toEqual(testData);
  });
});