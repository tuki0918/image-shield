import { CryptoUtils } from "@image-shield/core";
import { createPngFromBuffer, extractImageBuffer } from "./image";

const RGBA_CHANNELS = 4;
const PNG_UINT32_BYTES = 4;
const PNG_METADATA_SIZE = PNG_UINT32_BYTES * 3; // width + height + imageBufferLength

interface BlockCounts {
  blockCountX: number;
  blockCountY: number;
}

interface ImageBlobToBlocksResult {
  blocks: Buffer[];
  width: number;
  height: number;
  channels: number;
  blockCountX: number;
  blockCountY: number;
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
 * Extract blocks from an image blob
 * @param imageBlob Image blob (PNG, JPEG, etc.)
 * @param blockSize Size of each block
 * @returns Promise resolving to blocks and metadata
 */
export async function imageBlobToBlocks(
  imageBlob: Blob,
  blockSize: number,
): Promise<ImageBlobToBlocksResult> {
  const { imageBuffer, width, height } = await extractImageBuffer(imageBlob);

  const { blockCountX, blockCountY } = calculateBlockCounts(
    width,
    height,
    blockSize,
  );
  const blocks: Buffer[] = [];

  for (let blockY = 0; blockY < blockCountY; blockY++) {
    for (let blockX = 0; blockX < blockCountX; blockX++) {
      const block = extractBlock(
        imageBuffer,
        width,
        height,
        blockX,
        blockY,
        blockSize,
      );
      blocks.push(block);
    }
  }

  return {
    blocks,
    width,
    height,
    channels: RGBA_CHANNELS,
    blockCountX,
    blockCountY,
  };
}

/**
 * Extract a single block from image buffer
 * @param imageBuffer Raw RGBA image buffer
 * @param imageWidth Original image width
 * @param imageHeight Original image height
 * @param blockX Block X coordinate
 * @param blockY Block Y coordinate
 * @param blockSize Block size
 * @returns Buffer containing the block data
 */
function extractBlock(
  imageBuffer: Buffer,
  imageWidth: number,
  imageHeight: number,
  blockX: number,
  blockY: number,
  blockSize: number,
): Buffer {
  const startX = blockX * blockSize;
  const startY = blockY * blockSize;
  const endX = Math.min(startX + blockSize, imageWidth);
  const endY = Math.min(startY + blockSize, imageHeight);

  const blockWidth = endX - startX;
  const blockHeight = endY - startY;
  const blockBuffer = Buffer.alloc(blockSize * blockSize * RGBA_CHANNELS);

  for (let y = 0; y < blockHeight; y++) {
    for (let x = 0; x < blockWidth; x++) {
      const srcOffset =
        ((startY + y) * imageWidth + (startX + x)) * RGBA_CHANNELS;
      const dstOffset = (y * blockSize + x) * RGBA_CHANNELS;

      blockBuffer[dstOffset] = imageBuffer[srcOffset]; // R
      blockBuffer[dstOffset + 1] = imageBuffer[srcOffset + 1]; // G
      blockBuffer[dstOffset + 2] = imageBuffer[srcOffset + 2]; // B
      blockBuffer[dstOffset + 3] = imageBuffer[srcOffset + 3]; // A
    }
  }

  return blockBuffer;
}

/**
 * Reconstruct image from blocks
 * @param blocks Array of block buffers
 * @param imageWidth Target image width
 * @param imageHeight Target image height
 * @param blockSize Block size
 * @returns Promise resolving to PNG Blob
 */
export async function blocksToPngBlob(
  blocks: Buffer[],
  imageWidth: number,
  imageHeight: number,
  blockSize: number,
): Promise<Blob> {
  const { blockCountX, blockCountY } = calculateBlockCounts(
    imageWidth,
    imageHeight,
    blockSize,
  );
  const imageBuffer = Buffer.alloc(imageWidth * imageHeight * RGBA_CHANNELS);

  let blockIndex = 0;
  for (let blockY = 0; blockY < blockCountY; blockY++) {
    for (let blockX = 0; blockX < blockCountX; blockX++) {
      if (blockIndex < blocks.length) {
        insertBlock(
          imageBuffer,
          imageWidth,
          imageHeight,
          blockX,
          blockY,
          blockSize,
          blocks[blockIndex],
        );
        blockIndex++;
      }
    }
  }

  return await createPngFromBuffer(imageBuffer, imageWidth, imageHeight);
}

/**
 * Insert a block into the image buffer
 * @param imageBuffer Target image buffer
 * @param imageWidth Image width
 * @param imageHeight Image height
 * @param blockX Block X coordinate
 * @param blockY Block Y coordinate
 * @param blockSize Block size
 * @param blockBuffer Block data buffer
 */
function insertBlock(
  imageBuffer: Buffer,
  imageWidth: number,
  imageHeight: number,
  blockX: number,
  blockY: number,
  blockSize: number,
  blockBuffer: Buffer,
): void {
  const startX = blockX * blockSize;
  const startY = blockY * blockSize;
  const endX = Math.min(startX + blockSize, imageWidth);
  const endY = Math.min(startY + blockSize, imageHeight);

  const blockWidth = endX - startX;
  const blockHeight = endY - startY;

  for (let y = 0; y < blockHeight; y++) {
    for (let x = 0; x < blockWidth; x++) {
      const srcOffset = (y * blockSize + x) * RGBA_CHANNELS;
      const dstOffset =
        ((startY + y) * imageWidth + (startX + x)) * RGBA_CHANNELS;

      imageBuffer[dstOffset] = blockBuffer[srcOffset]; // R
      imageBuffer[dstOffset + 1] = blockBuffer[srcOffset + 1]; // G
      imageBuffer[dstOffset + 2] = blockBuffer[srcOffset + 2]; // B
      imageBuffer[dstOffset + 3] = blockBuffer[srcOffset + 3]; // A
    }
  }
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
 * Decrypt PNG image blob and extract original PNG
 * @param encryptedPngBlob Encrypted PNG blob
 * @param secretKey Secret key for decryption
 * @param manifestId Manifest ID used for IV generation
 * @returns Promise resolving to original PNG Blob
 */
export async function decryptPngImageBlob(
  encryptedPngBlob: Blob,
  secretKey: string,
  manifestId: string,
): Promise<Blob> {
  // Extract raw RGBA image buffer from encrypted PNG
  const { imageBuffer: encryptedImageData } =
    await extractImageBuffer(encryptedPngBlob);

  // Remove padding from encrypted data
  const encryptedData = removePadding(encryptedImageData);

  // Decrypt the data using the async crypto provider
  const { BrowserCryptoProvider } = await import("./crypto");
  const cryptoProvider = new BrowserCryptoProvider();

  const decryptedData = await cryptoProvider.decryptBufferAsync(
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

  // Create PNG from image buffer
  return await createPngFromBuffer(
    originalImageBuffer,
    originalWidth,
    originalHeight,
  );
}
