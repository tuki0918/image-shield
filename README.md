# image-shield

![](.docs/figure.png)

This npm package provides functionality for image fragmentation and restoration.

## Architecture

This project is organized as a monorepo with the following packages:

- **@image-shield/core**: Environment-independent core functionality (types, algorithms, crypto interfaces)
- **@image-shield/node**: Node.js implementation with file system operations and Jimp integration
- **@image-shield/browser**: Browser implementation (reserved for future development)
- **@image-shield/cli**: CLI implementation (reserved for future development)

## Features

This package provides image fragmentation using shuffle-only mode:

### 🔀 Shuffle Mode
- Images are fragmented using a shuffling algorithm to obscure the original content.

```
Original Image → Load → Convert to RGBA → Shuffle → Fragmented PNG Output
```

## Installation

```
npm i image-shield
```

## Usage

```
import ImageShield from "image-shield";
```

### Shuffle Mode

Image fragmentation using shuffle algorithm to protect images.

**Fragment**

```ts
await ImageShield.encrypt({
  // config: { /** FragmentationConfig */ },
  imagePaths: [
    "./input_1.png",
    "./input_2.png",
    "./input_3.png",
  ],
  outputDir: "./output/fragmented",
});
```

<details>
<summary>Output:</summary>

```
output
└── fragmented
    ├── img_1_fragmented.png
    ├── img_2_fragmented.png
    ├── img_3_fragmented.png
    └── manifest.json
```

| input 1 | input 2 | input 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/input_sample.png) | ![](.docs/input_sample_mono.png) | ![](.docs/input_sample_blue.png) |
| 500 x 500px (109KB) | 400 x 600px (4KB) | 600 x 400px (3KB) |

| output 1 | output 2 | output 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/fragmented1/img_1_fragmented.png) | ![](.docs/fragmented1/img_2_fragmented.png) | ![](.docs/fragmented1/img_3_fragmented.png) |
| 494 x 494px (334KB) | 494 x 494px (335KB) | 494 x 494px (334KB) |

</details>

**Restore**

```ts
await ImageShield.decrypt({
  manifestPath: "./output/fragmented/manifest.json",
  imagePaths: [
    "./output/fragmented/img_1_fragmented.png",
    "./output/fragmented/img_2_fragmented.png",
    "./output/fragmented/img_3_fragmented.png",
  ],
  outputDir: "./output/restored",
});
```

<details>
<summary>Output:</summary>

```
output
└── restored
    ├── img_1.png
    ├── img_2.png
    └── img_3.png
```

| input 1 | input 2 | input 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/fragmented1/img_1_fragmented.png) | ![](.docs/fragmented1/img_2_fragmented.png) | ![](.docs/fragmented1/img_3_fragmented.png) |
| 494 x 494px (334KB) | 494 x 494px (335KB) | 494 x 494px (334KB) |

| output 1 | output 2 | output 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/restored1/img_1.png) | ![](.docs/restored1/img_2.png) | ![](.docs/restored1/img_3.png) |
| 500 x 500px (117KB) | 400 x 600px (2KB) | 600 x 400px (2KB) |

</details>

---

## Shuffle Overview

### List by blockSize

| input | blockSize: 1 | blockSize: 2 (default) | blockSize: 3 | blockSize: 4 |
|:-------:|:---------------:|:---------------:|:---------------:|:----------------:|
| ![](.docs/input_sample.png) | ![](.docs/output_1.png) | ![](.docs/output_2.png) | ![](.docs/output_3.png) | ![](.docs/output_4.png) |
| 500 x 500px (109KB) | 400 x 600px (4KB) | 600 x 400px (3KB) |

| output 1 | output 2 | output 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/fragmented2/img_1_fragmented.png) | ![](.docs/fragmented2/img_2_fragmented.png) | ![](.docs/fragmented2/img_3_fragmented.png) |
| 494 x 494px (976KB) | 494 x 494px (976KB) | 494 x 494px (976KB) |

</details>

**Decrypt**

```ts
await ImageShield.decrypt({
  manifestPath: "./output/fragmented/manifest.json",
  imagePaths: [
    "./output/fragmented/img_1_fragmented.png",
    "./output/fragmented/img_2_fragmented.png",
    "./output/fragmented/img_3_fragmented.png",
  ],
  outputDir: "./output/restored",
  secretKey: "secret",
});
```

<details>
<summary>Output:</summary>

```
output
└── restored
    ├── img_1.png
    ├── img_2.png
    └── img_3.png
```

| input 1 | input 2 | input 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/fragmented2/img_1_fragmented.png) | ![](.docs/fragmented2/img_2_fragmented.png) | ![](.docs/fragmented2/img_3_fragmented.png) |
| 494 x 494px (976KB) | 494 x 494px (976KB) | 494 x 494px (976KB) |

| output 1 | output 2 | output 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/restored2/img_1.png) | ![](.docs/restored2/img_2.png) | ![](.docs/restored2/img_3.png) |
| 500 x 500px (117KB) | 400 x 600px (2KB) | 600 x 400px (2KB) |

</details>


## Shuffle Overview

### List by blockSize

| input | blockSize: 1 | blockSize: 2 (default) | blockSize: 3 | blockSize: 4 |
|:-------:|:---------------:|:---------------:|:---------------:|:----------------:|
| ![](.docs/input_sample.png) | ![](.docs/output_1.png) | ![](.docs/output_2.png) | ![](.docs/output_3.png) | ![](.docs/output_4.png) |

| blockSize: 8 | blockSize: 16 | blockSize: 32 | blockSize: 50 | blockSize: 128 |
|:-------:|:---------------:|:---------------:|:---------------:|:----------------:|
| ![](.docs/output_8.png) | ![](.docs/output_16.png) | ![](.docs/output_32.png) | ![](.docs/output_50.png) | ![](.docs/output_128.png) |

### Input multiple images

blockSize: `50`

| input 1 | input 2 | input 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/input_sample.png) | ![](.docs/input_sample_mono.png) | ![](.docs/input_sample_blue.png) |

| output 1 | output 2 | output 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/output_m0.png) | ![](.docs/output_m1.png) | ![](.docs/output_m2.png) |

## Manifest Structure

manifest.json:

```json
{
  "id": "cd3c6a30-17ed-4893-85ea-8e644ab1a4a1",
  "version": "0.8.0",
  "timestamp": "2025-07-10T00:21:16.699Z",
  "config": {
    "blockSize": 2,
    "prefix": "img",
    "seed": 860865,
    "restoreFileName": false
  },
  "images": [
    {
      "w": 501,
      "h": 500,
      "c": 4,
      "x": 251,
      "y": 250
    },
    {
      "w": 490,
      "h": 490,
      "c": 4,
      "x": 245,
      "y": 245
    },
    {
      "w": 490,
      "h": 490,
      "c": 4,
      "x": 245,
      "y": 245
    }
  ],
  "algorithm": "aes-256-cbc",
  "secure": true
}
```
</details>

---

> [!NOTE]
> - Images are fragmented using shuffle-only mode.
> - The `manifest.json` file contains the necessary information for restoration.
> - Input images are converted to PNG format.

## Clients

- [Raycast Extension](https://github.com/tuki0918/raycast-image-shield)

