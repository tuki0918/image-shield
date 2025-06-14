import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import { ImageFragmenter } from "./fragmenter";
import type { FragmentationResult } from "./types";
import { generateFragmentFileName } from "./utils/helpers";

describe("ImageFragmenter", () => {
  // Use OS temp directory for test files
  const tmpDir = path.join(tmpdir(), "fragmenter_test_tmp");
  const originalImages = [
    Buffer.from([
      // 2x2 RGBA image 1
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
    ]),
    Buffer.from([
      // 2x2 RGBA image 2
      0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 64, 64, 64, 255,
    ]),
  ];
  const width = 2;
  const height = 2;
  const blockSize = 1;
  const secretKey = "fragmenter-test-key";
  const prefix = "fragtestimg";
  let imagePaths: string[] = [];
  let manifest: FragmentationResult["manifest"] | null = null;
  let fragmentBuffers: Buffer[] = [];

  beforeAll(async () => {
    // Create tmp directory and save original images as PNG
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    imagePaths = [];
    for (let i = 0; i < originalImages.length; i++) {
      const filePath = path.join(tmpDir, `original_${i}.png`);
      const image = Jimp.fromBitmap({
        data: originalImages[i],
        width,
        height,
      });
      await image.write(filePath, JimpMime.png);
      imagePaths.push(filePath);
    }
    // Fragment images
    const fragmenter = new ImageFragmenter({ blockSize, prefix }, secretKey);
    const result = await fragmenter.fragmentImages(imagePaths);
    manifest = result.manifest;
    fragmentBuffers = result.fragmentedImages;
  });

  afterAll(() => {
    // Clean up tmp files
    for (const f of imagePaths) {
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  });

  test("creates manifest with correct structure", () => {
    expect(manifest).toBeDefined();
    expect(manifest?.images.length).toBe(originalImages.length);
    expect(manifest?.config.blockSize).toBe(blockSize);
    expect(manifest?.config.prefix).toBe(prefix);
  });

  test("creates correct number of fragment images", () => {
    expect(fragmentBuffers.length).toBe(originalImages.length);
    for (const buf of fragmentBuffers) {
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBeGreaterThan(0);
    }
  });

  test("fragment images are valid PNGs", async () => {
    for (const buf of fragmentBuffers) {
      if (secretKey) {
        // If encrypted, it is correct that it cannot be opened as PNG
        await expect(async () => {
          await Jimp.read(buf);
        }).rejects.toThrow();
      } else {
        // If not encrypted, it should be openable as PNG
        const jimpImage = await Jimp.read(buf);
        expect(jimpImage.mime).toBe("image/png");
        expect(jimpImage.bitmap.width).toBeGreaterThan(0);
        expect(jimpImage.bitmap.height).toBeGreaterThan(0);
      }
    }
  });

  test("fragment file naming uses prefix and zero padding", () => {
    for (let i = 0; i < fragmentBuffers.length; i++) {
      const ext = secretKey ? "png.enc" : "png";
      const expectedName = generateFragmentFileName(
        prefix,
        i,
        fragmentBuffers.length,
        {
          isFragmented: true,
          isEncrypted: !!secretKey,
        },
      );
      expect(expectedName).toMatch(
        new RegExp(
          `^${prefix}_${i + 1}_shuffled\\.${ext.replace(".", "\\.")}$`,
        ),
      );
    }
  });

  test("manifest contains correct algorithm and secure fields", () => {
    expect(manifest).toBeDefined();
    // algorithm field should be defined
    expect(manifest?.algorithm).toBeDefined();
    if (secretKey) {
      expect(manifest?.algorithm).toBe("aes-256-cbc");
      expect(manifest?.secure).toBe(true);
    } else {
      expect(manifest?.algorithm).toBeUndefined();
      expect(manifest?.secure).toBe(false);
    }
  });

  test("manifest config and images fields are valid", () => {
    expect(manifest?.config).toBeDefined();
    expect(typeof manifest?.config.blockSize).toBe("number");
    expect(typeof manifest?.config.prefix).toBe("string");
    expect(Array.isArray(manifest?.images)).toBe(true);
    for (const img of manifest?.images || []) {
      expect(typeof img.w).toBe("number");
      expect(typeof img.h).toBe("number");
      expect(typeof img.x).toBe("number");
      expect(typeof img.y).toBe("number");
      expect(typeof img.c).toBe("number");
    }
  });
});
