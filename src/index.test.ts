import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import ImageShield from "./index";

describe("ImageShield (integration)", () => {
  // Use OS temp directory for test files
  const tmpDir = path.join(tmpdir(), "index_test_tmp");
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
  const secretKey = "index-test-key";
  const prefix = "indextestimg";
  let imagePaths: string[] = [];
  let manifestPath = "";
  let fragmentPaths: string[] = [];
  let restoredPaths: string[] = [];

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
    // Fragment images using ImageShield.encrypt
    await ImageShield.encrypt({
      imagePaths,
      config: { blockSize, prefix },
      outputDir: tmpDir,
      secretKey,
    });
    // Find manifest and fragment files
    manifestPath = path.join(tmpDir, "manifest.json");
    fragmentPaths = [];
    for (let i = 0; i < originalImages.length; i++) {
      const ext = secretKey ? ".png.enc" : ".png";
      fragmentPaths.push(path.join(tmpDir, `${prefix}_${i}${ext}`));
    }
    // Restore images using ImageShield.decrypt
    await ImageShield.decrypt({
      imagePaths: fragmentPaths,
      manifestPath,
      outputDir: tmpDir,
      secretKey,
    });
    // Find restored images (use the same logic as index.ts, based on fragmentPaths)
    restoredPaths = [];
    for (let i = 0; i < fragmentPaths.length; i++) {
      restoredPaths.push(path.join(tmpDir, `${prefix}_${i}.png`));
    }
  });

  afterAll(() => {
    // Clean up tmp files
    for (const f of [
      ...imagePaths,
      ...fragmentPaths,
      ...restoredPaths,
      manifestPath,
    ]) {
      if (f && fs.existsSync(f)) fs.unlinkSync(f);
    }
    if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
  });

  test("restored images match original images", async () => {
    // Check that manifest.json exists
    expect(fs.existsSync(manifestPath)).toBe(true);

    // Check that fragment images exist and are valid PNGs
    for (const fragmentPath of fragmentPaths) {
      expect(fs.existsSync(fragmentPath)).toBe(true);
      if (secretKey) {
        // If encrypted, it is correct that it cannot be opened as PNG
        await expect(async () => {
          await sharp(fragmentPath).metadata();
        }).rejects.toThrow();
      } else {
        // If not encrypted, it should be openable as PNG
        const meta = await sharp(fragmentPath).metadata();
        expect(meta.format).toBe("png");
        expect(meta.width).toBe(width);
        expect(meta.height).toBe(height);
      }
    }

    // Check that restored images exist before comparing content
    for (const restoredPath of restoredPaths) {
      expect(fs.existsSync(restoredPath)).toBe(true);
    }

    // Check that restored images match original images
    for (let i = 0; i < originalImages.length; i++) {
      const orig = await sharp(imagePaths[i]).ensureAlpha().raw().toBuffer();
      const restored = await sharp(restoredPaths[i])
        .ensureAlpha()
        .raw()
        .toBuffer();
      expect(restored).toEqual(orig);
    }
  });
});
