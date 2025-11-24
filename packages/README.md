# Image Shield Packages

This directory contains the individual packages of the image-shield monorepo:

## @image-shield/core
Environment-independent core functionality including:
- Type definitions and interfaces
- Crypto provider abstraction
- Block distribution algorithms
- Helper functions

## @image-shield/node
Node.js-specific implementation including:
- File system operations
- Image processing with Jimp
- Node.js crypto provider
- Main ImageFragmenter and ImageRestorer classes

## @image-shield/browser (Reserved)
Future browser implementation will include:
- Browser-compatible crypto provider
- Canvas-based image processing
- File API integration

## @image-shield/cli (Reserved) 
Future CLI implementation will include:
- Command-line interface
- Batch processing utilities
- Configuration file support