import { blocksToImageBuffer, bufferToPng } from "./block";

/**
 * Generate a PNG buffer from an array of block buffers
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
  const imageBuffer = blocksToImageBuffer(blocks, width, height, blockSize);
  return await bufferToPng(imageBuffer, width, height, channels);
}
