import {
  type CryptoProvider,
  InvalidUUIDFormatError,
} from "@image-shield/core";

// Browser-specific crypto provider interface using browser-native types
export interface BrowserCryptoProvider
  extends Omit<
    CryptoProvider,
    "encryptBuffer" | "decryptBuffer" | "keyTo32" | "uuidToIV"
  > {
  encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array;
  decryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array;
  decryptBufferAsync(
    buffer: Uint8Array,
    key: string,
    iv: Uint8Array,
  ): Promise<Uint8Array>;
  keyTo32(key: string): Uint8Array;
  keyTo32Async(key: string): Promise<Uint8Array>;
  uuidToIV(uuid: string): Uint8Array;
}

// Browser implementation needs to be async, but the interface is sync
// We'll create a wrapper that handles the async nature
export class BrowserCryptoProviderImpl implements BrowserCryptoProvider {
  private static cachedKeys = new Map<string, CryptoKey>();

  encryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array {
    throw new Error("Encrypt functionality not implemented for browser");
  }

  decryptBuffer(buffer: Uint8Array, key: string, iv: Uint8Array): Uint8Array {
    // For sync compatibility, we need to implement sync AES-CBC decryption
    // This is a simplified implementation - in production, you might want to use a crypto library
    throw new Error("Synchronous decryption not yet implemented. Use async decryptBufferAsync.");
  }

  async decryptBufferAsync(
    buffer: Uint8Array,
    key: string,
    iv: Uint8Array,
  ): Promise<Uint8Array> {
    // Use the sync keyTo32 method that's compatible with Node.js
    const keyBuffer = this.keyTo32(key);

    // Import key for AES-CBC (cache it for reuse)
    let cryptoKey = BrowserCryptoProviderImpl.cachedKeys.get(key);
    if (!cryptoKey) {
      cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBuffer,
        { name: "AES-CBC" },
        false,
        ["decrypt"],
      );
      BrowserCryptoProviderImpl.cachedKeys.set(key, cryptoKey);
    }

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: iv,
      },
      cryptoKey,
      buffer,
    );

    // Convert back to Uint8Array
    return new Uint8Array(decryptedData);
  }

  keyTo32(key: string): Uint8Array {
    // Use a JavaScript implementation of SHA-256 for sync compatibility with Node.js
    // This ensures the same key derivation as Node.js crypto.createHash("sha256")
    return this.sha256Sync(key);
  }

  // Synchronous SHA-256 implementation compatible with Node.js
  private sha256Sync(message: string): Uint8Array {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    // SHA-256 constants
    const K = new Uint32Array([
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);

    // Initial hash values
    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    // Pre-processing: adding padding bits
    const msgLength = data.length;
    const msgBitLength = msgLength * 8;
    
    // Add padding
    const paddingLength = msgLength % 64 < 56 ? 56 - (msgLength % 64) : 120 - (msgLength % 64);
    const paddedLength = msgLength + paddingLength + 8;
    const paddedMessage = new Uint8Array(paddedLength);
    
    paddedMessage.set(data, 0);
    paddedMessage[msgLength] = 0x80;
    
    // Append length in bits as 64-bit big-endian
    const view = new DataView(paddedMessage.buffer);
    view.setUint32(paddedLength - 4, msgBitLength >>> 0, false);
    view.setUint32(paddedLength - 8, (msgBitLength / 0x100000000) >>> 0, false);

    // Process the message in 512-bit chunks
    for (let i = 0; i < paddedLength; i += 64) {
      const chunk = paddedMessage.subarray(i, i + 64);
      const w = new Uint32Array(64);
      
      // Copy chunk into first 16 words of message schedule array
      for (let j = 0; j < 16; j++) {
        w[j] = new DataView(chunk.buffer, chunk.byteOffset + j * 4, 4).getUint32(0, false);
      }
      
      // Extend the first 16 words into the remaining 48 words
      for (let j = 16; j < 64; j++) {
        const s0 = this.rightRotate(w[j - 15], 7) ^ this.rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = this.rightRotate(w[j - 2], 17) ^ this.rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }
      
      // Initialize working variables
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      
      // Main loop
      for (let j = 0; j < 64; j++) {
        const S1 = this.rightRotate(e, 6) ^ this.rightRotate(e, 11) ^ this.rightRotate(e, 25);
        const ch = (e & f) ^ ((~e) & g);
        const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
        const S0 = this.rightRotate(a, 2) ^ this.rightRotate(a, 13) ^ this.rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) >>> 0;
        
        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }
      
      // Add the compressed chunk to the current hash value
      h0 = (h0 + a) >>> 0;
      h1 = (h1 + b) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + h) >>> 0;
    }

    // Produce the final hash value as a 256-bit number (32 bytes)
    const result = new Uint8Array(32);
    const resultView = new DataView(result.buffer);
    resultView.setUint32(0, h0, false);
    resultView.setUint32(4, h1, false);
    resultView.setUint32(8, h2, false);
    resultView.setUint32(12, h3, false);
    resultView.setUint32(16, h4, false);
    resultView.setUint32(20, h5, false);
    resultView.setUint32(24, h6, false);
    resultView.setUint32(28, h7, false);
    
    return result;
  }

  private rightRotate(value: number, amount: number): number {
    return ((value >>> amount) | (value << (32 - amount))) >>> 0;
  }

  async keyTo32Async(key: string): Promise<Uint8Array> {
    // Proper async implementation using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  }

  generateUUID(): string {
    // Use crypto.randomUUID if available, otherwise fallback
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback UUID generation
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  uuidToIV(uuid: string): Uint8Array {
    const hex = uuid.replace(/-/g, "");
    if (hex.length !== 32) {
      throw new InvalidUUIDFormatError("Invalid UUID format");
    }

    // Convert hex string to Uint8Array
    const result = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      result[i] = Number.parseInt(hex.substr(i * 2, 2), 16);
    }
    return result;
  }
}
