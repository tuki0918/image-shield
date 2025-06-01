import { bufferToPng, placeBlock } from "./block";

/**
 * Common function to generate an image buffer from an array of blocks and convert it to PNG
 * @param blocks Array of block buffers
 * @param width Image width
 * @param height Image height
 * @param blockSize Block size
 * @param channels Number of channels (default: 4)
 * @returns PNG buffer (Promise)
 */
export async function assembleImageFromBlocks(
  blocks: Buffer[],
  width: number,
  height: number,
  blockSize: number,
  channels = 4,
): Promise<Buffer> {
  const imageBuffer = Buffer.alloc(width * height * channels);
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
  return await bufferToPng(imageBuffer, width, height, channels);
}
