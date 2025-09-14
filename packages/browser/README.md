# @image-shield/browser

Browser implementation of image-shield for decrypting fragmented images using browser-compatible APIs.

## Features

- **Decrypt Only**: Focused on decryption functionality (encrypt is not implemented)
- **Browser APIs**: Uses Web Crypto API, Canvas API, and File API
- **TypeScript**: Full TypeScript support with type definitions
- **No Dependencies**: Only depends on `@image-shield/core` and browser APIs

## Installation

```bash
npm install @image-shield/browser
```

## Usage

### Basic Decryption

```typescript
import BrowserImageShield from '@image-shield/browser';

// Using File inputs from HTML form
const fragmentFiles: File[] = [/* fragment files from input */];
const manifestFile: File = /* manifest file from input */;
const secretKey = 'your-secret-key';

// Decrypt and auto-download restored images
// Note: Fragment files are automatically sorted by filename to ensure correct order
const restoredFiles = await BrowserImageShield.decrypt({
  imageFiles: fragmentFiles,
  manifestFile: manifestFile,
  secretKey: secretKey,
  autoDownload: true // Will automatically trigger downloads
});
```

**Important**: Fragment files must be named correctly (e.g., `img_1_fragmented.png`, `img_2_fragmented.png`) to ensure proper ordering during restoration. The library automatically sorts files by their numeric suffix.

### Working with Blobs

```typescript
// If you want to work with blobs instead of files
const restoredBlobs = await BrowserImageShield.decryptToBlobs({
  imageFiles: fragmentFiles,
  manifestFile: manifestFile,
  secretKey: secretKey
});

// Process blobs as needed
for (const blob of restoredBlobs) {
  const url = URL.createObjectURL(blob);
  // Use blob URL...
  URL.revokeObjectURL(url); // Clean up when done
}
```

### HTML Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Image Shield Browser Demo</title>
</head>
<body>
  <div>
    <label for="fragments">Select Fragment Files:</label>
    <input type="file" id="fragments" multiple accept="image/*">
    <small>Note: Select all fragment files (they will be automatically sorted by filename)</small>
  </div>
  
  <div>
    <label for="manifest">Select Manifest File:</label>
    <input type="file" id="manifest" accept=".json">
  </div>
  
  <div>
    <label for="secretKey">Secret Key:</label>
    <input type="text" id="secretKey" placeholder="Enter secret key">
  </div>
  
  <button onclick="decryptImages()">Decrypt Images</button>

  <script type="module">
    import BrowserImageShield from './node_modules/@image-shield/browser/dist/index.js';
    
    window.decryptImages = async function() {
      const fragmentInput = document.getElementById('fragments');
      const manifestInput = document.getElementById('manifest');
      const secretKeyInput = document.getElementById('secretKey');
      
      if (!fragmentInput.files?.length || !manifestInput.files?.length) {
        alert('Please select fragment files and manifest file');
        return;
      }
      
      try {
        const restoredFiles = await BrowserImageShield.decrypt({
          imageFiles: Array.from(fragmentInput.files),
          manifestFile: manifestInput.files[0],
          secretKey: secretKeyInput.value || undefined,
          autoDownload: true
        });
        
        console.log('Decryption successful!', restoredFiles);
      } catch (error) {
        console.error('Decryption failed:', error);
        alert('Decryption failed. Please check your files and secret key.');
      }
    };
  </script>
</body>
</html>
```

## API Reference

### `BrowserImageShield.decrypt(options)`

Decrypt fragmented images and return as File objects.

**Parameters:**
- `options.imageFiles`: Array of fragment image File objects
- `options.manifestFile`: Manifest File object
- `options.secretKey`: Secret key for decryption (optional)
- `options.autoDownload`: Whether to automatically download restored images (default: true)

**Returns:** `Promise<File[]>` - Array of restored image files

### `BrowserImageShield.decryptToBlobs(options)`

Decrypt fragmented images and return as Blob objects (no auto-download).

**Parameters:**
- `options.imageFiles`: Array of fragment image File objects
- `options.manifestFile`: Manifest File object
- `options.secretKey`: Secret key for decryption (optional)

**Returns:** `Promise<Blob[]>` - Array of restored image blobs

## Browser Compatibility

- Modern browsers with Web Crypto API support
- ES2020+ JavaScript environment
- Canvas API support for image processing
- File API support for file handling

## Limitations

- **Decrypt Only**: Encryption functionality is not implemented
- **Modern Browsers**: Requires modern browser APIs (Web Crypto, Canvas, File API)
- **Single-threaded**: Image processing is synchronous and may block UI for large images
- **Memory Usage**: Large images are processed in memory, which may cause issues with very large files

## Architecture

The browser implementation uses:

- **Web Crypto API** for AES-256-CBC decryption
- **Canvas API** for image processing and pixel manipulation
- **File API** for file handling and blob operations
- **Buffer polyfill** for cross-platform compatibility

## Error Handling

The library throws descriptive errors for common issues:

- Invalid file inputs
- Missing or corrupted manifest files
- Incorrect secret keys
- Unsupported image formats
- Browser API availability

```typescript
try {
  const result = await BrowserImageShield.decrypt(options);
} catch (error) {
  if (error.message.includes('manifestFile must be a File object')) {
    // Handle invalid manifest file
  } else if (error.message.includes('Invalid UUID format')) {
    // Handle crypto-related errors
  } else {
    // Handle other errors
  }
}
```

## Troubleshooting

### Multiple Images Not Restoring Correctly

If single images restore correctly but multiple images fail, this is usually due to **file ordering issues**. The browser implementation automatically sorts fragment files by their numeric suffix to ensure correct restoration order.

**Solution**: Ensure your fragment files are named with the correct pattern:
- ✅ Good: `img_1_fragmented.png`, `img_2_fragmented.png`, `img_3_fragmented.png`  
- ❌ Bad: `fragmented_img1.png`, `img_frag_1.png`, random names

### Performance Considerations

- **Large Images**: Processing time increases with image size. Consider using smaller block sizes for better performance.
- **Memory Usage**: The browser keeps all images in memory during processing. Very large images may cause memory issues.
- **File API Limits**: Some browsers have limits on file sizes and concurrent operations.

## Browser Compatibility

- **Modern Browsers**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **Required APIs**: Web Crypto API, Canvas API, File API
- **Not Supported**: Internet Explorer