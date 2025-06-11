import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Jimp, JimpMime } from "jimp";
import { ImageFragmenter } from "./fragmenter";
import { ImageRestorer } from "./restorer";

describe("ImageRestorer", () => {
  // Use OS temp directory for test files
  const tmpDir = path.join(tmpdir(), "restorer_test_tmp");
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
  const secretKey = "restorer-test-key";
  const prefix = "resttestimg";
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
    const { manifest, fragmentedImages } =
      await fragmenter.fragmentImages(imagePaths);
    // Save manifest and fragments
    manifestPath = path.join(tmpDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    fragmentPaths = fragmentedImages.map((buf, i) => {
      const ext = secretKey ? ".png.enc" : ".png";
      const p = path.join(tmpDir, `${prefix}_${i}${ext}`);
      fs.writeFileSync(p, buf);
      return p;
    });
    // Restore images
    const restorer = new ImageRestorer(secretKey);
    const restoredImages = await restorer.restoreImages(
      fragmentPaths,
      manifest,
    );
    restoredPaths = restoredImages.map((buf, i) => {
      const p = path.join(tmpDir, `restored_${i}.png`);
      fs.writeFileSync(p, buf);
      return p;
    });
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
    for (let i = 0; i < originalImages.length; i++) {
      const orig = await Jimp.read(imagePaths[i]);
      const restored = await Jimp.read(restoredPaths[i]);
      expect(restored.getBuffer(JimpMime.png)).toEqual(
        orig.getBuffer(JimpMime.png),
      );
    }
  });
});
