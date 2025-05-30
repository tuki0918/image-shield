# [PoC] image-shield

![](.docs/figure.png)


## NOTE

1. Run `npm ci`
2. Update `package.json`
    - Required updates: `name`, `license`, `author`, `repository`
3. Update `LICENSE`
    - Required updates: `author`

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
