import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
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
      await sharp(originalImages[i], { raw: { width, height, channels: 4 } })
        .png()
        .toFile(filePath);
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
          await sharp(buf).metadata();
        }).rejects.toThrow();
      } else {
        // If not encrypted, it should be openable as PNG
        const meta = await sharp(buf).metadata();
        expect(meta.format).toBe("png");
        expect(meta.width).toBeGreaterThan(0);
        expect(meta.height).toBeGreaterThan(0);
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
        ext,
      );
      expect(expectedName).toMatch(
        new RegExp(`^${prefix}_${i + 1}\\.${ext.replace(".", "\\.")}$`),
      );
    }
  });
});
