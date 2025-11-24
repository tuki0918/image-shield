import { describe, expect, test } from "vitest";
import { BrowserCryptoProviderImpl } from "./crypto";
import { parseImageBufferMetadata, removePadding } from "./block";

describe("Browser Decryption Integration", () => {
  test("parseImageBufferMetadata should work correctly", () => {
    const metadata = new Uint8Array(12);
    const view = new DataView(metadata.buffer);
    
    // Set test values
    view.setUint32(0, 100, false); // width = 100
    view.setUint32(4, 200, false); // height = 200
    view.setUint32(8, 1024, false); // imageBufferLength = 1024
    
    const parsed = parseImageBufferMetadata(metadata);
    
    expect(parsed.width).toBe(100);
    expect(parsed.height).toBe(200);
    expect(parsed.imageBufferLength).toBe(1024);
  });

  test("removePadding should remove trailing zeros", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 0, 0, 0]);
    const trimmed = removePadding(data);
    
    expect(trimmed).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
    
    // Test with no padding
    const noPadding = new Uint8Array([1, 2, 3, 4, 5]);
    const noChange = removePadding(noPadding);
    expect(noChange).toEqual(noPadding);
    
    // Test with all zeros - should return the original buffer since we can't determine data length
    const allZeros = new Uint8Array([0, 0, 0, 0]);
    const stillZeros = removePadding(allZeros);
    expect(stillZeros).toEqual(allZeros); // All zeros case keeps the buffer as-is
  });

  test("crypto provider caching should work", async () => {
    const provider = new BrowserCryptoProviderImpl();
    const key = "test-key";
    const iv = provider.uuidToIV("550e8400-e29b-41d4-a716-446655440000");
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    
    // Manually encrypt the data
    const keyBytes = provider.keyTo32(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw", 
      keyBytes, 
      { name: "AES-CBC" }, 
      false, 
      ["encrypt"]
    );
    
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv: iv },
      cryptoKey,
      data
    );
    
    // First call should cache the key
    const result1 = await provider.decryptBufferAsync(
      new Uint8Array(encrypted),
      key,
      iv
    );
    
    // Second call should use cached key
    const result2 = await provider.decryptBufferAsync(
      new Uint8Array(encrypted),
      key,
      iv
    );
    
    expect(result1).toEqual(data);
    expect(result2).toEqual(data);
    expect(result1).toEqual(result2);
  });

  test("full encrypt-decrypt cycle should work", async () => {
    const provider = new BrowserCryptoProviderImpl();
    const secretKey = "test-secret-key";
    const manifestId = "550e8400-e29b-41d4-a716-446655440000";
    
    // Create test data that simulates the structure of encrypted image data
    // This simulates: [metadata(12 bytes)][image data]
    const metadata = new Uint8Array(12);
    const metadataView = new DataView(metadata.buffer);
    metadataView.setUint32(0, 4, false); // width = 4
    metadataView.setUint32(4, 4, false); // height = 4
    metadataView.setUint32(8, 16, false); // imageBufferLength = 16
    
    const imageData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    
    // Combine metadata + image data (this is what gets encrypted in the real flow)
    const combinedData = new Uint8Array(metadata.length + imageData.length);
    combinedData.set(metadata, 0);
    combinedData.set(imageData, metadata.length);
    
    // Encrypt using browser crypto
    const keyBytes = provider.keyTo32(secretKey);
    const ivBytes = provider.uuidToIV(manifestId);
    
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-CBC" },
      false,
      ["encrypt"]
    );
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: ivBytes,
      },
      cryptoKey,
      combinedData
    );
    
    // Now decrypt using the browser implementation
    const decrypted = await provider.decryptBufferAsync(
      new Uint8Array(encrypted),
      secretKey,
      ivBytes
    );
    
    // Verify the decrypted data matches original combined data
    expect(decrypted).toEqual(combinedData);
    
    // Verify we can parse the metadata correctly
    const parsedMetadata = parseImageBufferMetadata(decrypted.subarray(0, 12));
    expect(parsedMetadata.width).toBe(4);
    expect(parsedMetadata.height).toBe(4);
    expect(parsedMetadata.imageBufferLength).toBe(16);
    
    // Verify the image data is correct
    const extractedImageData = decrypted.subarray(12, 12 + parsedMetadata.imageBufferLength);
    expect(extractedImageData).toEqual(imageData);
  });

  test("should handle different key types consistently", async () => {
    const provider = new BrowserCryptoProviderImpl();
    
    const testKeys = [
      "short",
      "medium-length-key",
      "very-long-key-with-special-chars!@#$%^&*()",
      "unicode-key-你好世界",
      "key with spaces and numbers 123"
    ];
    
    for (const key of testKeys) {
      const key1 = provider.keyTo32(key);
      const key2 = provider.keyTo32(key);
      
      expect(key1).toEqual(key2);
      expect(key1).toHaveLength(32);
      
      // Verify the key can be used for encryption/decryption
      const testData = new Uint8Array(16).fill(42);
      const iv = provider.uuidToIV("550e8400-e29b-41d4-a716-446655440000");
      
      const cryptoKey = await crypto.subtle.importKey(
        "raw", 
        key1, 
        { name: "AES-CBC" }, 
        false, 
        ["encrypt"]
      );
      
      const encrypted = await crypto.subtle.encrypt(
        { name: "AES-CBC", iv: iv },
        cryptoKey,
        testData
      );
      
      const decrypted = await provider.decryptBufferAsync(
        new Uint8Array(encrypted),
        key,
        iv
      );
      
      expect(decrypted).toEqual(testData);
    }
  });
});