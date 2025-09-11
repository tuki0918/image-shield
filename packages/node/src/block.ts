import { Jimp, JimpMime } from "jimp";
import { CryptoUtils } from "@image-shield/core";

const RGBA_CHANNELS = 4;
const PNG_UINT32_BYTES = 4;
const PNG_METADATA_SIZE = PNG_UINT32_BYTES * 3; // width + height + imageBufferLength

interface BlockCounts {
  blockCountX: number;
  blockCountY: number;
}

interface ImageFileToBlocksResult {
  blocks: Buffer[];
  width: number;
  height: number;
  channels: number;
  blockCountX: number;
  blockCountY: number;
}

interface BlockPosition {
  x: number;
  y: number;
}

interface BlockDimensions {
  width: number;
  height: number;
}

/**
 * Create a Jimp image from raw RGBA image buffer
 * @param imageBuffer Raw RGBA image buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Jimp image instance
 */
function createJimpFromImageBuffer(
  imageBuffer: Buffer,
  width: number,
  height: number,
): InstanceType<typeof Jimp> {
  return new Jimp({
    data: imageBuffer,
    width,
    height,
  });
}

/**
 * Format error message consistently
 * @param operation Description of the operation that failed
 * @param error The error that occurred
 * @returns Formatted error message
 */
function formatErrorMessage(operation: string, error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  return `${operation}: ${errorMessage}`;
}

/**
 * Convert raw RGBA image buffer to PNG buffer using Jimp
 * @param imageBuffer Raw RGBA image buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Promise resolving to PNG buffer
 */
async function imageBufferToPng(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  const image = createJimpFromImageBuffer(imageBuffer, width, height);
  return await image.getBuffer(JimpMime.png);
}

/**
 * Calculate block counts for width and height
 * @param width Image width
 * @param height Image height
 * @param blockSize Block size
 * @returns Object with blockCountX and blockCountY
 */
function calculateBlockCounts(
  width: number,
  height: number,
  blockSize: number,
): BlockCounts {
  return {
    blockCountX: Math.ceil(width / blockSize),
    blockCountY: Math.ceil(height / blockSize),
  };
}

/**
 * Calculate actual block dimensions at edge positions
 * @param position Block position (x or y)
 * @param blockSize Standard block size
 * @param imageSize Image dimension (width or height)
 * @param blockCount Total block count in that dimension
 * @returns Actual block dimension
 */
function calculateActualBlockSize(
  position: number,
  blockSize: number,
  imageSize: number,
  blockCount: number,
): number {
  const isEdgeBlock = position === blockCount - 1;
  return isEdgeBlock ? imageSize - position * blockSize : blockSize;
}

/**
 * Calculate block dimensions considering edge cases
 * @param position Block position
 * @param blockSize Standard block size
 * @param imageWidth Image width
 * @param imageHeight Image height
 * @param blockCounts Block counts
 * @returns Block dimensions
 */
function calculateBlockDimensions(
  position: BlockPosition,
  blockSize: number,
  imageWidth: number,
  imageHeight: number,
  blockCounts: BlockCounts,
): BlockDimensions {
  return {
    width: calculateActualBlockSize(
      position.x,
      blockSize,
      imageWidth,
      blockCounts.blockCountX,
    ),
    height: calculateActualBlockSize(
      position.y,
      blockSize,
      imageHeight,
      blockCounts.blockCountY,
    ),
  };
}

/**
 * Extract a block from an image buffer
 * @param buffer Source image buffer (RGBA format)
 * @param imageWidth Image width in pixels
 * @param imageHeight Image height in pixels
 * @param startX Block top-left X coordinate
 * @param startY Block top-left Y coordinate
 * @param blockSize Maximum block size
 * @returns Block buffer containing pixel data
 */
export function extractBlock(
  buffer: Buffer,
  imageWidth: number,
  imageHeight: number | undefined,
  startX: number,
  startY: number,
  blockSize: number,
): Buffer {
  // Calculate actual block dimensions considering image boundaries
  const blockWidth = Math.min(blockSize, imageWidth - startX);
  const blockHeight =
    imageHeight !== undefined
      ? Math.min(blockSize, imageHeight - startY)
      : blockSize;

  const blockData: number[] = [];

  // Extract pixel data row by row
  for (let y = 0; y < blockHeight; y++) {
    for (let x = 0; x < blockWidth; x++) {
      const pixelX = startX + x;
      const pixelY = startY + y;
      const pixelIndex = (pixelY * imageWidth + pixelX) * RGBA_CHANNELS;

      // Copy RGBA channels
      for (let channel = 0; channel < RGBA_CHANNELS; channel++) {
        blockData.push(buffer[pixelIndex + channel] || 0);
      }
    }
  }

  return Buffer.from(blockData);
}

/**
 * Place block data at the specified position in the target image buffer
 * @param targetBuffer Target image buffer to place the block into
 * @param blockData Block data to place
 * @param targetWidth Target image width in pixels
 * @param destX Destination X coordinate
 * @param destY Destination Y coordinate
 * @param blockSize Standard block size
 * @param blockWidth Actual block width (optional, defaults to blockSize)
 * @param blockHeight Actual block height (optional, defaults to blockSize)
 */
export function placeBlock(
  targetBuffer: Buffer,
  blockData: Buffer,
  targetWidth: number,
  destX: number,
  destY: number,
  blockSize: number,
  blockWidth?: number,
  blockHeight?: number,
): void {
  const actualWidth = blockWidth ?? blockSize;
  const actualHeight = blockHeight ?? blockSize;

  // Place pixels row by row
  for (let y = 0; y < actualHeight; y++) {
    for (let x = 0; x < actualWidth; x++) {
      const sourceIndex = (y * actualWidth + x) * RGBA_CHANNELS;
      const targetIndex =
        ((destY + y) * targetWidth + (destX + x)) * RGBA_CHANNELS;

      // Ensure we don't write beyond buffer bounds
      if (targetIndex + RGBA_CHANNELS <= targetBuffer.length) {
        // Copy RGBA channels
        for (let channel = 0; channel < RGBA_CHANNELS; channel++) {
          targetBuffer[targetIndex + channel] =
            blockData[sourceIndex + channel];
        }
      }
    }
  }
}
/**
 * Split an RGBA image buffer into an array of blocks
 * @param buffer Source image buffer (RGBA format)
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param blockSize Block size in pixels
 * @returns Array of block buffers
 */
export function splitImageToBlocks(
  buffer: Buffer,
  width: number,
  height: number,
  blockSize: number,
): Buffer[] {
  const blocks: Buffer[] = [];
  const blockCounts = calculateBlockCounts(width, height, blockSize);

  // Process blocks row by row, left to right
  for (let blockY = 0; blockY < blockCounts.blockCountY; blockY++) {
    for (let blockX = 0; blockX < blockCounts.blockCountX; blockX++) {
      const startX = blockX * blockSize;
      const startY = blockY * blockSize;

      const block = extractBlock(
        buffer,
        width,
        height,
        startX,
        startY,
        blockSize,
      );

      blocks.push(block);
    }
  }

  return blocks;
}

/**
 * Reconstruct an RGBA image buffer from an array of blocks
 * @param blocks Array of block buffers
 * @param width Target image width in pixels
 * @param height Target image height in pixels
 * @param blockSize Block size in pixels
 * @returns Reconstructed image buffer
 */
export function blocksToImageBuffer(
  blocks: Buffer[],
  width: number,
  height: number,
  blockSize: number,
): Buffer {
  const imageBuffer = Buffer.alloc(width * height * RGBA_CHANNELS);
  const blockCounts = calculateBlockCounts(width, height, blockSize);

  let blockIndex = 0;

  // Place blocks row by row, left to right
  for (let blockY = 0; blockY < blockCounts.blockCountY; blockY++) {
    for (let blockX = 0; blockX < blockCounts.blockCountX; blockX++) {
      if (blockIndex >= blocks.length) {
        break;
      }

      const position: BlockPosition = { x: blockX, y: blockY };
      const dimensions = calculateBlockDimensions(
        position,
        blockSize,
        width,
        height,
        blockCounts,
      );

      const destX = blockX * blockSize;
      const destY = blockY * blockSize;

      placeBlock(
        imageBuffer,
        blocks[blockIndex],
        width,
        destX,
        destY,
        blockSize,
        dimensions.width,
        dimensions.height,
      );

      blockIndex++;
    }
  }

  return imageBuffer;
}

/**
 * Load an image from file or buffer and split into blocks
 * @param input Path to the image file or Buffer containing image data
 * @param blockSize Block size in pixels
 * @returns Promise resolving to block data and image metadata
 */
export async function imageFileToBlocks(
  input: string | Buffer,
  blockSize: number,
): Promise<ImageFileToBlocksResult> {
  try {
    // Load and process image with Jimp (automatically converts to RGBA)
    const image = await Jimp.read(input);
    const { width, height } = image.bitmap;
    const channels = RGBA_CHANNELS;
    const imageBuffer = image.bitmap.data;

    // Split image into blocks
    const blocks = splitImageToBlocks(imageBuffer, width, height, blockSize);
    const blockCounts = calculateBlockCounts(width, height, blockSize);

    return {
      blocks,
      width,
      height,
      channels,
      blockCountX: blockCounts.blockCountX,
      blockCountY: blockCounts.blockCountY,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error processing image file: ${errorMessage}`);
    throw new Error("The manifest file may not match the image data.");
  }
}

/**
 * Reconstruct a PNG image from blocks
 * @param blocks Array of block buffers
 * @param width Target image width in pixels
 * @param height Target image height in pixels
 * @param blockSize Block size in pixels
 * @returns Promise resolving to PNG buffer
 */
export async function blocksToPngImage(
  blocks: Buffer[],
  width: number,
  height: number,
  blockSize: number,
): Promise<Buffer> {
  try {
    const imageBuffer = blocksToImageBuffer(blocks, width, height, blockSize);
    return await createPngFromImageBuffer(imageBuffer, width, height);
  } catch (error) {
    throw new Error(
      formatErrorMessage("Failed to reconstruct PNG image from blocks", error),
    );
  }
}

/**
 * Extract raw RGBA image buffer from a PNG buffer using Jimp
 * @param pngBuffer PNG image buffer
 * @returns Promise resolving to image buffer and image dimensions
 */
export async function extractImageBufferFromPng(
  pngBuffer: Buffer,
): Promise<{ imageBuffer: Buffer; width: number; height: number }> {
  try {
    const image = await Jimp.read(pngBuffer);
    const { width, height } = image.bitmap;
    const imageBuffer = Buffer.from(image.bitmap.data);

    return { imageBuffer, width, height };
  } catch (error) {
    throw new Error(
      formatErrorMessage("Failed to extract image buffer from PNG", error),
    );
  }
}

/**
 * Create a PNG buffer from raw RGBA image buffer using Jimp
 * @param imageBuffer Raw RGBA image buffer
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @returns Promise resolving to PNG buffer
 */
export async function createPngFromImageBuffer(
  imageBuffer: Buffer,
  width: number,
  height: number,
): Promise<Buffer> {
  try {
    return await imageBufferToPng(imageBuffer, width, height);
  } catch (error) {
    throw new Error(
      formatErrorMessage("Failed to create PNG from image buffer", error),
    );
  }
}

/**
 * Create metadata buffer with image dimensions and image buffer length
 * @param width Image width
 * @param height Image height
 * @param imageBufferLength Image buffer length
 * @returns Metadata buffer (12 bytes)
 */
export function createImageBufferMetadata(
  width: number,
  height: number,
  imageBufferLength: number,
): Buffer {
  const metadata = Buffer.alloc(PNG_METADATA_SIZE); // 4 bytes for width, 4 bytes for height, 4 bytes for data length
  metadata.writeUInt32BE(width, 0);
  metadata.writeUInt32BE(height, PNG_UINT32_BYTES);
  metadata.writeUInt32BE(imageBufferLength, PNG_UINT32_BYTES * 2);
  return metadata;
}

/**
 * Parse metadata from buffer
 * @param metadataBuffer Buffer containing metadata
 * @returns Parsed metadata object
 */
export function parseImageBufferMetadata(metadataBuffer: Buffer): {
  width: number;
  height: number;
  imageBufferLength: number;
} {
  const width = metadataBuffer.readUInt32BE(0);
  const height = metadataBuffer.readUInt32BE(PNG_UINT32_BYTES);
  const imageBufferLength = metadataBuffer.readUInt32BE(PNG_UINT32_BYTES * 2);
  return { width, height, imageBufferLength };
}

/**
 * Remove trailing zero padding from buffer
 * @param buffer Buffer to trim
 * @returns Trimmed buffer
 */
export function removePadding(buffer: Buffer): Buffer {
  let actualDataLength = buffer.length;
  for (let i = buffer.length - 1; i >= 0; i--) {
    if (buffer[i] !== 0) {
      actualDataLength = i + 1;
      break;
    }
  }
  return buffer.subarray(0, actualDataLength);
}

/**
 * Calculate optimal square dimensions for given data length
 * @param dataLength Length of data in bytes
 * @returns Optimal width and height for square-like image
 */
export function calculateOptimalDimensions(dataLength: number): {
  width: number;
  height: number;
} {
  const width = Math.ceil(Math.sqrt(dataLength / RGBA_CHANNELS));
  const height = Math.ceil(dataLength / (width * RGBA_CHANNELS));
  return { width, height };
}

/**
 * Encrypt PNG image buffer with metadata
 * @param pngBuffer Original PNG buffer
 * @param secretKey Secret key for encryption
 * @param manifestId Manifest ID used for IV generation
 * @returns Encrypted PNG buffer
 */
export async function encryptPngImageBuffer(
  pngBuffer: Buffer,
  secretKey: string,
  manifestId: string,
): Promise<Buffer> {
  // Extract raw RGBA image buffer using block utility
  const { imageBuffer, width, height } =
    await extractImageBufferFromPng(pngBuffer);

  // Create metadata with original image buffer size and dimensions
  const metadata = createImageBufferMetadata(width, height, imageBuffer.length);

  // Combine metadata and image buffer
  const dataToEncrypt = Buffer.concat([metadata, imageBuffer]);

  // Encrypt the combined data
  const encryptedData = CryptoUtils.encryptBuffer(
    dataToEncrypt,
    secretKey,
    CryptoUtils.uuidToIV(manifestId),
  );

  // Calculate optimal dimensions for encrypted data
  const { width: encryptedWidth, height: encryptedHeight } =
    calculateOptimalDimensions(encryptedData.length);

  // Create a padded buffer to fit exactly in the image dimensions
  const paddedSize = encryptedWidth * encryptedHeight * RGBA_CHANNELS;
  const paddedData = Buffer.alloc(paddedSize);
  encryptedData.copy(paddedData, 0);

  // Convert encrypted data back to PNG using createPngFromImageBuffer
  return await createPngFromImageBuffer(
    paddedData,
    encryptedWidth,
    encryptedHeight,
  );
}

/**
 * Decrypt PNG image buffer and extract original PNG
 * @param encryptedPngBuffer Encrypted PNG buffer
 * @param secretKey Secret key for decryption
 * @param manifestId Manifest ID used for IV generation
 * @returns Original PNG buffer
 */
export async function decryptPngImageBuffer(
  encryptedPngBuffer: Buffer,
  secretKey: string,
  manifestId: string,
): Promise<Buffer> {
  // Extract raw RGBA image buffer from encrypted PNG using block utility
  const { imageBuffer: encryptedImageData } =
    await extractImageBufferFromPng(encryptedPngBuffer);

  // Remove padding from encrypted data
  const encryptedData = removePadding(encryptedImageData);

  // Decrypt the data
  const decryptedData = CryptoUtils.decryptBuffer(
    encryptedData,
    secretKey,
    CryptoUtils.uuidToIV(manifestId),
  );

  // Parse metadata from the beginning of decrypted data
  const {
    width: originalWidth,
    height: originalHeight,
    imageBufferLength: originalImageBufferLength,
  } = parseImageBufferMetadata(decryptedData.subarray(0, PNG_METADATA_SIZE));

  // Extract the original image buffer (skip 12 bytes of metadata)
  const originalImageBuffer = decryptedData.subarray(
    PNG_METADATA_SIZE,
    PNG_METADATA_SIZE + originalImageBufferLength,
  );

  // Create PNG from image buffer using block utility
  return await createPngFromImageBuffer(
    originalImageBuffer,
    originalWidth,
    originalHeight,
  );
}
