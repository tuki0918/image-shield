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
          `^${prefix}_${i + 1}_fragmented\\.${ext.replace(".", "\\.")}$`,
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

describe("ImageFragmenter (restoreFileName option)", () => {
  const tmpDir = path.join(tmpdir(), "fragmenter_test_tmp_restoreFileName");
  const originalImages = [
    Buffer.from([
      // 3x3 RGBA image 1
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255, 0, 255,
      255, 255, 255, 0, 255, 255, 128, 128, 128, 255, 64, 64, 64, 255, 32, 32,
      32, 255,
    ]),
    Buffer.from([
      // 3x3 RGBA image 2
      0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 64, 64, 64, 255, 32,
      32, 32, 255, 16, 16, 16, 255, 255, 0, 255, 255, 0, 255, 255, 255, 255,
      255, 0, 255,
    ]),
    Buffer.from([
      // 3x3 RGBA image 3
      10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
      130, 140, 150, 255, 160, 170, 180, 255, 190, 200, 210, 255, 220, 230, 240,
      255, 250, 240, 230, 255,
    ]),
  ];
  const width = 3;
  const height = 3;
  const blockSize = 2;
  const prefix = "fragtestimgorig";
  let imagePaths: string[] = [];
  let manifest: FragmentationResult["manifest"] | null = null;

  beforeAll(async () => {
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
    // restoreFileName: true でフラグメント化
    const fragmenter = new ImageFragmenter({
      blockSize,
      prefix,
      restoreFileName: true,
    });
    const result = await fragmenter.fragmentImages(imagePaths);
    manifest = result.manifest;
  });

  afterAll(() => {
    for (const f of imagePaths) {
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  });

  test("manifest images[].name contains original file name when restoreFileName=true", () => {
    expect(manifest).toBeDefined();
    expect(manifest?.config.restoreFileName).toBe(true);
    expect(Array.isArray(manifest?.images)).toBe(true);
    for (let i = 0; i < imagePaths.length; i++) {
      const expectedName = path.parse(imagePaths[i]).name;
      expect(manifest?.images[i].name).toBe(expectedName);
    }
  });
});
