# expo-assets-mcp

Local MCP server to generate and transform Expo assets. Also includes a CLI script to run it directly from the terminal.

---

## Project structure

```
src/
├── expo-assets.ts   ← reusable logic (asset definitions, image transformations)
├── index.ts         ← MCP server
└── generate.ts      ← CLI script
dist/                ← compiled output (generated with npm run build)
```

---

## Installation

```bash
npm install
npm run build
```

---

## Web Generator

A pure JavaScript version of this tool is available directly in the browser! Open `index.html` or visit [https://elber-code.github.io/expo-assets-mcp/](https://elber-code.github.io/expo-assets-mcp/) to access a rich GUI that features:
- **Interactive Cropper**: Perfectly center your icons with a 1:1 aspect ratio.
- **Live Icon Previews**: See how your icon looks in iOS (squircle) and Android (circle) shapes with transparent or solid backgrounds in real-time.
- **Advanced Banners**: Generate App Store mockups or promo banners by placing your Expo assets (e.g. Splash, Icon) inside custom resolutions to download individually.
- **Custom ZIP Assets**: Easily add extra custom-sized assets to the final ZIP.
- **Bilingual Interface**: Seamlessly switch between English and Spanish (`index_es.html`).

No backend or server required; everything is processed locally in your browser!

---

## CLI usage

Generates all Expo assets from a source image. Creates a folder next to the image named `<image>-assets/`.

```bash
node dist/generate.js <image-path> [options]
```

**Options:**

| Flag | Description |
|---|---|
| `--bg "#rrggbb"` | Background color. Omit for transparent |
| `--no-overwrite` | Skip files that already exist |

**Examples:**

```bash
# Transparent background
node dist/generate.js /Users/me/logo.png

# With background color
node dist/generate.js /Users/me/logo.png --bg "#E6F4FE"
```

**Output:**
```
/Users/me/logo-assets/
├── icon.png
├── android-icon-foreground.png
├── android-icon-background.png
├── android-icon-monochrome.png
├── splash-icon.png
├── favicon.png
├── react-logo.png
├── react-logo@2x.png
├── react-logo@3x.png
└── partial-react-logo.png
```

---

## MCP usage (Claude Desktop)

Copy `claude-config.example.json` to `claude-config.json`, fill in the correct path, then merge it into:

`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "expo-assets-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/expo-assets-mcp/dist/index.js"]
    }
  }
}
```

### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Available MCP tools

### `generate_expo_icons`

Generates all 10 Expo assets into a single `assets/images/` folder.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `input_image` | string | — | Absolute path to the source image |
| `output_dir` | string | — | Absolute path to the Expo project's `assets/images/` folder |
| `background_color` | string | transparent | Background color in hex (e.g. `#E6F4FE`). Omit for transparent. |
| `overwrite` | boolean | `true` | Overwrite existing files |
| `proportions` | object | see table | Content proportion per asset (0.1–1.0) |

**Proportions:**

| Key | Asset(s) | Default |
|---|---|---|
| `icon` | `icon.png` | `0.7` |
| `android_adaptive` | `android-icon-foreground/background.png` | `0.33` |
| `android_monochrome` | `android-icon-monochrome.png` | `0.33` |
| `splash` | `splash-icon.png` | `0.5` |
| `favicon` | `favicon.png` | `0.8` |
| `react_logo` | `react-logo.png` + `@2x` + `@3x` | `0.8` |
| `partial_logo` | `partial-react-logo.png` | `0.5` |

---

### `transform_image`

Transforms an image to specific dimensions with optional content proportion and background.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `input_image` | string | — | Path to the source image (PNG, JPEG, WebP, TIFF, AVIF) |
| `output_path` | string | — | Full output path including filename and extension (e.g. `/path/result.webp`) |
| `width` | number | — | Output canvas width in pixels |
| `height` | number | — | Output canvas height in pixels |
| `proportion` | number | `1` | How much of the canvas the content fills (0.1–1.0, 1 = fills everything) |
| `background_color` | string | transparent | Canvas background color in hex. Omit for transparent. |
| `format` | `png\|jpeg\|webp` | `png` | **Output** file format |
| `quality` | number | `95` | Compression quality for jpeg/webp only (1 = lowest, 100 = highest) |

---

### `convert_svg`

Converts an SVG file to PNG, JPEG, or WebP at the specified dimensions.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `input_svg` | string | — | Absolute path to the source SVG file |
| `output_path` | string | — | Full output path including filename and extension |
| `width` | number | — | Output width in pixels |
| `height` | number | proportional | Output height in pixels. Omit to scale proportionally from width. |
| `format` | `png\|jpeg\|webp` | `png` | Output file format |
| `background_color` | string | transparent | Background color in hex. Omit for transparent (PNG only). |
| `quality` | number | `95` | Compression quality for jpeg/webp only (1 = lowest, 100 = highest) |

---

## Generated assets

Expo handles all platform-specific resizing automatically from these 10 files.

### Source image requirements
- Format: **PNG**
- Minimum size: **1024×1024 px**
- Background: **transparent** (recommended)

### Asset table

| File | Canvas | Background | Transformation | app.json key |
|---|---|---|---|---|
| `icon.png` | 1024×1024 | `background_color` or transparent | `contain`, centered, prop 0.7 | `expo.icon` |
| `android-icon-foreground.png` | 512×512 | Always transparent | `contain`, centered, prop 0.33 | `android.adaptiveIcon.foregroundImage` |
| `android-icon-background.png` | 512×512 | `background_color` or transparent | `contain`, centered, prop 0.33 | `android.adaptiveIcon.backgroundImage` |
| `android-icon-monochrome.png` | 432×432 | Always transparent | White silhouette, prop 0.33 | `android.adaptiveIcon.monochromeImage` |
| `splash-icon.png` | 1024×1024 | Always transparent | `contain`, centered, prop 0.5 | `expo-splash-screen > image` |
| `favicon.png` | 48×48 | Always transparent | `contain`, centered, prop 0.8 | `web.favicon` |
| `react-logo.png` | 100×100 | Always transparent | `contain`, centered, prop 0.8 | Decorative UI @1x |
| `react-logo@2x.png` | 200×200 | Always transparent | `contain`, centered, prop 0.8 | Decorative UI @2x |
| `react-logo@3x.png` | 300×300 | Always transparent | `contain`, centered, prop 0.8 | Decorative UI @3x |
| `partial-react-logo.png` | 518×316 | Always transparent | Right-side crop from top, prop 0.5 | Decorative UI partial |

### Special transformations

#### `android-icon-monochrome.png` — White silhouette
Every non-transparent pixel is converted to pure white. Android 13+ uses this for *Themed Icons*, tinting the silhouette with the system color theme.

```
pixel (r, g, b, a > 10)  →  (255, 255, 255, a)
pixel (r, g, b, a ≤ 10)  →  unchanged (transparent)
```

#### `partial-react-logo.png` — Section crop
A section of the source image is cropped without distortion:
- **Horizontal:** right side (end)
- **Vertical:** from the top (start)
- The section is scaled proportionally to fit the 518×316 canvas

`partial_logo: 0.5` → right half · `partial_logo: 0.33` → right third

#### Android adaptive icon — Safe zone

Keep important content within the **66% center** (338×338 px on a 512×512 canvas) to avoid being clipped by any Android launcher shape.

```
┌─────────────────┐  512×512
│                 │
│  ┌───────────┐  │
│  │  safe     │  │  338×338 (66%)
│  │  zone     │  │
│  └───────────┘  │
│                 │
└─────────────────┘
```

---

## Scripts

```bash
npm run build   # compile TypeScript
npm start       # start MCP server
npm run dev     # run with tsx (no compile needed)
```
