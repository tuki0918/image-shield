# @image-shield/cli

CLI implementation of image fragmentation and restoration using the `@image-shield/node` library.

## Installation

```bash
npm install @image-shield/cli
```

## Usage

The CLI provides two main commands: `shuffle` and `restore`.

### Global Help

```bash
image-shield --help
```

```
Usage: image-shield [options] [command]

CLI tool for image fragmentation and restoration

Options:
  -V, --version                     output the version number
  -h, --help                        display help for command

Commands:
  shuffle [options] <images...>     Fragment images
  restore [options] <fragments...>  Restore fragmented images
  help [command]                    display help for command
```

### Shuffle Command

Fragment images into multiple pieces.

```bash
image-shield shuffle <images...> -o <output_directory> [options]
```

#### Options

| Option | Description | Required | Default |
|--------|-------------|----------|---------|
| `-o, --output <dir>` | Output directory for fragments and manifest | ✅ | - |
| `-b, --block-size <size>` | Pixel block size (positive integer) | ❌ | 10 |
| `-p, --prefix <prefix>` | Prefix for fragment files | ❌ | "fragment" |
| `-s, --seed <seed>` | Random seed (integer) | ❌ | auto-generated |
| `--preserve-name` | Preserve original file names | ❌ | false |

#### Examples

**Basic fragmentation:**
```bash
image-shield shuffle image1.jpg image2.png -o ./fragments
```

**Custom configuration:**
```bash
image-shield shuffle *.jpg -o ./output -b 20 -p "my_fragment" --preserve-name
```

**With seed for reproducible results:**
```bash
image-shield shuffle image.png -o ./output -s 12345
```

#### Output Structure

After fragmentation, the output directory will contain:
```
output/
├── manifest.json          # Metadata for restoration
├── fragment_0000.png      # Fragment files
├── fragment_0001.png
└── ...
```

### Restore Command

Restore fragmented images using the manifest file.

```bash
image-shield restore <fragments...> -m <manifest_path> -o <output_directory> [options]
```

#### Options

| Option | Description | Required |
|--------|-------------|----------|
| `-m, --manifest <path>` | Path to the manifest.json file | ✅ |
| `-o, --output <dir>` | Output directory for restored images | ✅ |

#### Examples

**Basic restoration:**
```bash
image-shield restore ./fragments/*.png -m ./fragments/manifest.json -o ./restored
```

**Specific fragments:**
```bash
image-shield restore fragment_0000.png fragment_0001.png fragment_0002.png -m manifest.json -o ./output
```

## Error Handling

The CLI provides clear error messages for common issues:

- **File not found**: When input images or manifest don't exist
- **Invalid options**: When required options are missing or invalid
- **Restoration errors**: When fragments are corrupted or manifest doesn't match
- **Permission errors**: When output directory cannot be created

## Examples Workflow

### Complete Workflow Example

1. **Prepare images:**
   ```bash
   ls images/
   # photo1.jpg  photo2.png  document.pdf
   ```

2. **Fragment images:**
   ```bash
   image-shield shuffle images/photo1.jpg images/photo2.png -o ./backup --preserve-name
   ```
   ```
   🔀 Starting image fragmentation...
   ✅ Images fragmented successfully to: /path/to/backup
   ```

3. **Check output:**
   ```bash
   ls backup/
   # manifest.json  fragment_0000.png  fragment_0001.png  fragment_0002.png  fragment_0003.png
   ```

4. **Restore images:**
   ```bash
   image-shield restore backup/*.png -m backup/manifest.json -o ./restored
   ```
   ```
   🔀 Starting image restoration...
   ✅ Images restored successfully to: /path/to/restored
   ```

5. **Verify restoration:**
   ```bash
   ls restored/
   # photo1.jpg  photo2.png
   ```

### Advanced Configuration Example

For custom fragmentation:

```bash
# Fragment with custom settings
image-shield shuffle sensitive/*.jpg \
  -o ./vault \
  -b 5 \
  -p "secure_chunk" \
  -s 42 \
  --preserve-name

# The output will use smaller blocks (5x5 pixels) and custom naming
```

## Integration with Scripts

### Bash Script Example

```bash
#!/bin/bash

# Backup script
IMAGES_DIR="./photos"
BACKUP_DIR="./backup"

# Create backup
echo "Creating backup..."
image-shield shuffle "$IMAGES_DIR"/*.{jpg,png} \
  -o "$BACKUP_DIR" \
  --preserve-name

if [ $? -eq 0 ]; then
  echo "✅ Backup completed successfully"
  # Optionally remove original files or move them
else
  echo "❌ Backup failed"
  exit 1
fi
```

### Recovery Script Example

```bash
#!/bin/bash

# Recovery script
BACKUP_DIR="./backup"
RESTORE_DIR="./recovered_photos"

# Restore from backup
echo "Restoring from backup..."
image-shield restore "$BACKUP_DIR"/fragment_*.png \
  -m "$BACKUP_DIR/manifest.json" \
  -o "$RESTORE_DIR"

if [ $? -eq 0 ]; then
  echo "✅ Recovery completed successfully"
else
  echo "❌ Recovery failed"
  exit 1
fi
```

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/tuki0918/image-shield.git
cd image-shield

# Install dependencies
npm install

# Build the CLI
npm run build

# Test the CLI
cd packages/cli
npm test
```

### Running in Development Mode

```bash
cd packages/cli
npm run dev -- shuffle --help
```

## Related Packages

- [`@image-shield/core`](../core) - Core fragmentation logic
- [`@image-shield/node`](../node) - Node.js implementation
- [`@image-shield/browser`](../browser) - Browser implementation (coming soon)

## License

See the [LICENSE](../../LICENSE) file in the root directory.

## Support

For issues and questions, please visit the [GitHub repository](https://github.com/tuki0918/image-shield/issues).
