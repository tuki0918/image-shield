# [PoC] image-shield

This npm package provides functionality for image fragmentation and restoration.

![](.docs/figure.png)


## Installation

```
npm i image-shield
```

## Usage

```
import ImageShield from "image-shield";
```

`encrypt`

```ts
await ImageShield.encrypt({
  imagePaths: ["./input_0.png", "./input_1.png", "./input_2.png"],
  config: {
    blockSize: 32, // Smaller for security, larger for performance
    prefix: "img",
  },
  outputDir: "./output/fragments",
  secretKey: "secret",
});
```

`decrypt`

```ts
await ImageShield.decrypt({
  imagePaths: [
    "./output/fragments/img_0.png",
    "./output/fragments/img_1.png",
    "./output/fragments/img_2.png",
  ],
  manifestPath: "./output/fragments/manifest.json",
  outputDir: "./output/restored",
  secretKey: "secret",
});
```

## Output: blockSize

| input | blockSize: 10 | blockSize: 32 | blockSize: 128 |
|:-------:|:---------------:|:---------------:|:----------------:|
| ![](.docs/input_sample.png) | ![](.docs/output_10.png) | ![](.docs/output_32.png) | ![](.docs/output_128.png) |

## Output: Multiple images

| input 1 | input 2 | input 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/input_sample.png) | ![](.docs/input_sample_mono.png) | ![](.docs/input_sample_blue.png) |

| output 1 | output 2 | output 3 |
|:-------:|:---------------:|:---------------:|
| ![](.docs/output_m0.png) | ![](.docs/output_m1.png) | ![](.docs/output_m2.png) |
