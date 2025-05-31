# [PoC] image-shield

![](.docs/figure.png)


## Usage

`encrypt`

```
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

```
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


## COMMAND

```bash
# test
npm run test
# format
npm run check:fix
```

## RELEASE

1. Set the secret environment variable: `NPM_TOKEN`
    - [Using secrets in GitHub Actions](https://docs.github.com/ja/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions)
2. Increase the package version
    - Use the `npm version` command
3. Release the package
    - [How to create a release](https://docs.github.com/ja/repositories/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release)
