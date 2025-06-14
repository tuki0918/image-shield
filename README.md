# image-shield

![](.docs/figure.png)

This npm package provides functionality for image fragmentation and restoration.

## Features

This package provides two main modes for image fragmentation:

- **Shuffle only**: If `secretKey` is not set, only shuffling is performed (no encryption).
- **Shuffle + Encrypt (recommended)**: If `secretKey` is set, both shuffling and encryption are performed.

---

## Installation

```
npm i image-shield
```

## Usage

```
import ImageShield from "image-shield";
```

### Shuffle only

If you do not set the `secretKey`, only shuffling will be applied to the image blocks.

**Encrypt**

```ts
await ImageShield.encrypt({
  imagePaths: [
    "./input_1.png",
    "./input_2.png",
    "./input_3.png",
  ],
  config: {
    blockSize: 32,
    prefix: "img",
  },
  outputDir: "./output/fragmented",
  // secretKey: undefined
});
```

<details>
<summary>Output:</summary>

```
output
└── fragmented
    ├── img_1_shuffled.png
    ├── img_2_shuffled.png
    ├── img_3_shuffled.png
    └── manifest.json
```
</details>

**Decrypt**

```ts
await ImageShield.decrypt({
  imagePaths: [
    "./output/fragmented/img_1_shuffled.png",
    "./output/fragmented/img_2_shuffled.png",
    "./output/fragmented/img_3_shuffled.png",
  ],
  manifestPath: "./output/fragmented/manifest.json",
  outputDir: "./output/restored",
  // secretKey: undefined
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
</details>

---

### Shuffle + Encrypt (recommended)

If you set the `secretKey`, the image blocks will be shuffled and then encrypted.

**Encrypt**

```ts
await ImageShield.encrypt({
  imagePaths: [
    "./input_1.png",
    "./input_2.png",
    "./input_3.png",
  ],
  config: {
    blockSize: 32,
    prefix: "img",
  },
  outputDir: "./output/fragmented",
  secretKey: "secret",
});
```

<details>
<summary>Output:</summary>

```
output
└── fragmented
    ├── img_1_shuffled.png.enc
    ├── img_2_shuffled.png.enc
    ├── img_3_shuffled.png.enc
    └── manifest.json
```
</details>

**Decrypt**

```ts
await ImageShield.decrypt({
  imagePaths: [
    "./output/fragmented/img_1_shuffled.png.enc",
    "./output/fragmented/img_2_shuffled.png.enc",
    "./output/fragmented/img_3_shuffled.png.enc",
  ],
  manifestPath: "./output/fragmented/manifest.json",
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
</details>


## Shuffle Overview

### List by blockSize

| input | blockSize: 10 | blockSize: 32 | blockSize: 128 |
|:-------:|:---------------:|:---------------:|:----------------:|
| ![](.docs/input_sample.png) | ![](.docs/output_10.png) | ![](.docs/output_32.png) | ![](.docs/output_128.png) |

### Input multiple images

blockSize: `32`

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
  "id": "b8d686d0-7eb1-4504-83ee-a3f0a5026752",
  "version": "0.5.0",
  "timestamp": "2025-06-03T16:09:57.417Z",
  "config": {
    "blockSize": 32,
    "prefix": "img",
    "seed": 115247
  },
  "images": [
    {
      "w": 500,
      "h": 500,
      "c": 4,
      "x": 16,
      "y": 16
    },
    {
      "w": 400,
      "h": 600,
      "c": 4,
      "x": 13,
      "y": 19
    },
    {
      "w": 600,
      "h": 400,
      "c": 4,
      "x": 19,
      "y": 13
    }
  ],
  "algorithm": "aes-256-cbc",
  "secure": true
}
```

</details>

---

> [!NOTE]
> - The recommended mode is **Shuffle + Encrypt** for better security.
> - The `manifest.json` file contains the necessary information for restoration, but it does not include the secret key.
> - Input images are converted to PNG format.
