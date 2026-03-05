# Build Icons

Packaging icon assets for Electron Builder.

## Sources

These files are derived from:

- `design/logo-final/duplex-icon-03-final.svg`

## Packaging usage

- Linux AppImage icon set: `build/icons/png`
- macOS icon bundle: `build/icons/icon.icns`
- Base PNG source: `build/icons/icon.png`

If the logo changes, regenerate this folder from the latest approved logo asset.

## Regenerate

```bash
# Generate macOS ICNS from the final SVG source
BUN_TMPDIR=/tmp BUN_INSTALL=/tmp bunx --yes icon-gen \
  -i design/logo-final/duplex-icon-03-final.svg \
  -o build/icons \
  --icns --icns-name icon --icns-sizes 16,32,64,128,256,512,1024
```
