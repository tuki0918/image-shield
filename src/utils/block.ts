import { Jimp, JimpMime } from "jimp";

/**
 * Extract a block from a buffer (specify image width/height/start position/block size)
 * Fixed to RGBA channels
 *
 * @param buffer Source image buffer (Uint8Array)
 * @param imageWidth Image width
 * @param imageHeight Image height (optional)
 * @param startX Block top-left X
 * @param startY Block top-left Y
 * @param blockSize Block size
 * @returns Block buffer (Uint8Array)
 */
export function extractBlock(
  buffer: Uint8Array,
  imageWidth: number,
  imageHeight: number | undefined,
  startX: number,
  startY: number,
  blockSize: number,
): Uint8Array {
  const channels = 4;
  const blockWidth = imageWidth
    ? Math.min(blockSize, imageWidth - startX)
    : blockSize;
  const blockHeight =
    imageHeight !== undefined
      ? Math.min(blockSize, imageHeight - startY)
      : blockSize;
  const blockData: number[] = [];
  for (let y = 0; y < blockHeight; y++) {
    for (let x = 0; x < blockWidth; x++) {
      const srcX = startX + x;
      const srcY = startY + y;
      const pixelIndex = (srcY * imageWidth + srcX) * channels;
      for (let c = 0; c < channels; c++) {
        blockData.push(buffer[pixelIndex + c] || 0);
      }
    }
  }
  return new Uint8Array(blockData);
}

/**
 * Place block data at the specified position in the image buffer
 * Fixed to RGBA channels
 *
 * @param targetBuffer Target buffer (Uint8Array)
 * @param blockData Block data (Uint8Array)
 * @param targetWidth Target image width
 * @param destX Destination X
 * @param destY Destination Y
 * @param blockSize Block size
 * @param blockWidth Block width (optional)
 * @param blockHeight Block height (optional)
 */
export function placeBlock(
  targetBuffer: Uint8Array,
  blockData: Uint8Array,
  targetWidth: number,
  destX: number,
  destY: number,
  blockSize: number,
  blockWidth?: number,
  blockHeight?: number,
): void {
  const channels = 4;
  const w = blockWidth ?? blockSize;
  const h = blockHeight ?? blockSize;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIndex = (y * w + x) * channels;
      const destIndex = ((destY + y) * targetWidth + (destX + x)) * channels;
      if (destIndex + channels <= targetBuffer.length) {
        for (let c = 0; c < channels; c++) {
          targetBuffer[destIndex + c] = blockData[srcIndex + c];
        }
      }
    }
  }
}

/**
 * Convert a raw image buffer to PNG Buffer using Jimp
 * @param buffer Raw image buffer (Uint8Array)
 * @param width Image width
 * @param height Image height
 * @returns PNG Buffer (Promise<Uint8Array>)
 */
export async function bufferToPng(
  buffer: Uint8Array,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const image = Jimp.fromBitmap({
    data: buffer,
    width,
    height,
  });
  return await image.getBuffer(JimpMime.png);
}

/**
 * Split an image buffer into an array of blocks (RGBA only)
 * @param buffer Image buffer (Uint8Array)
 * @param width Image width
 * @param height Image height
 * @param blockSize Block size
 * @returns Array of block buffers (Uint8Array[])
 */
export function splitImageToBlocks(
  buffer: Uint8Array,
  width: number,
  height: number,
  blockSize: number,
): Uint8Array[] {
  const blocks: Uint8Array[] = [];
  const blockCountX = Math.ceil(width / blockSize);
  const blockCountY = Math.ceil(height / blockSize);
  for (let by = 0; by < blockCountY; by++) {
    for (let bx = 0; bx < blockCountX; bx++) {
      const block = extractBlock(
        buffer,
        width,
        height,
        bx * blockSize,
        by * blockSize,
        blockSize,
      );
      blocks.push(block);
    }
  }
  return blocks;
}

/**
 * Reconstruct an image buffer from an array of blocks (RGBA only)
 * @param blocks Array of block buffers (Uint8Array[])
 * @param width Image width
 * @param height Image height
 * @param blockSize Block size
 * @returns Image buffer (Uint8Array)
 */
export function blocksToImageBuffer(
  blocks: Uint8Array[],
  width: number,
  height: number,
  blockSize: number,
): Uint8Array {
  const channels = 4;
  const imageBuffer = new Uint8Array(width * height * channels);
  const blockCountX = Math.ceil(width / blockSize);
  const blockCountY = Math.ceil(height / blockSize);
  let blockIndex = 0;
  for (let by = 0; by < blockCountY; by++) {
    for (let bx = 0; bx < blockCountX; bx++) {
      if (blockIndex < blocks.length) {
        const blockWidth =
          bx === blockCountX - 1 ? width - bx * blockSize : blockSize;
        const blockHeight =
          by === blockCountY - 1 ? height - by * blockSize : blockSize;
        placeBlock(
          imageBuffer,
          blocks[blockIndex],
          width,
          bx * blockSize,
          by * blockSize,
          blockSize,
          blockWidth,
          blockHeight,
        );
        blockIndex++;
      }
    }
  }
  return imageBuffer;
}

/**
 * Load an image from file or buffer, convert to RGBA, and split into blocks
 * @param input Path to the image file or Buffer
 * @param blockSize Block size
 * @returns Promise resolving to an array of block buffers
 */
export async function imageFileToBlocks(
  input: string | Uint8Array,
  blockSize: number,
): Promise<{
  blocks: Uint8Array[];
  width: number;
  height: number;
  channels: number;
  blockCountX: number;
  blockCountY: number;
}> {
  try {
    // Uint8Array to ArrayBuffer
    const source = ArrayBuffer.isView(input) ? input.buffer : input;
    if (source instanceof SharedArrayBuffer) {
      throw new Error("SharedArrayBuffer is not supported.");
    }

    // Load image with Jimp
    const image = await Jimp.read(source);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const channels = 4; // Always use RGBA
    // Ensure image is RGBA (Jimp always loads as RGBA)
    const imageBuffer = image.bitmap.data;
    const blocks = splitImageToBlocks(imageBuffer, width, height, blockSize);
    const blockCountX = Math.ceil(width / blockSize);
    const blockCountY = Math.ceil(height / blockSize);
    return { blocks, width, height, channels, blockCountX, blockCountY };
  } catch (e) {
    throw new Error("The manifest file may not match the image data.");
  }
}

/**
 * Reconstruct a PNG image from blocks, width, height, blockSize, and channels
 * @param blocks Array of block buffers (Uint8Array[])
 * @param width Image width
 * @param height Image height
 * @param blockSize Block size
 * @returns Promise resolving to PNG buffer (Uint8Array)
 */
export async function blocksToPngImage(
  blocks: Uint8Array[],
  width: number,
  height: number,
  blockSize: number,
): Promise<Uint8Array> {
  const imageBuffer = blocksToImageBuffer(blocks, width, height, blockSize);
  return await bufferToPng(imageBuffer, width, height);
}

/**
 * Calculate the number of blocks assigned to each fragment image
 * @param totalBlocks Total number of blocks
 * @param fragmentCount Number of fragment images
 * @returns Array of block counts per fragment
 */
export function calcBlocksPerFragment(
  totalBlocks: number,
  fragmentCount: number,
): number[] {
  const blocksPerImage = Math.ceil(totalBlocks / fragmentCount);
  let remainingBlocks = totalBlocks;
  const fragmentBlocksCount: number[] = [];
  for (let i = 0; i < fragmentCount; i++) {
    const count = Math.min(blocksPerImage, remainingBlocks);
    fragmentBlocksCount.push(count);
    remainingBlocks -= count;
  }
  return fragmentBlocksCount;
}
