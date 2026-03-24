import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExpoAsset {
  filename: string;
  canvasW: number;
  canvasH: number;
  description: string;
  keepAlpha: boolean;
  monochrome?: boolean;
  partial?: boolean;
  proportionKey: string;
  defaultProportion: number;
}

export interface GenerateOptions {
  backgroundColor?: string;
  overwrite?: boolean;
  proportions?: Partial<Record<string, number>>;
}

export interface GeneratedFile {
  file: string;
  canvas: string;
  proportion: number;
  description: string;
}

export interface GenerateResult {
  generated: GeneratedFile[];
  skipped: string[];
  errors: string[];
}

// ─── Expo asset definitions ───────────────────────────────────────────────────
// canvas: final file size (fixed by Expo spec)
// proportionKey: which parameter controls how much content fills the canvas
// defaultProportion: fallback value when the user does not provide one

export const EXPO_ASSETS: ExpoAsset[] = [
  {
    filename: "icon.png",
    canvasW: 1024, canvasH: 1024,
    description: "Main app icon — iOS + Android fallback",
    keepAlpha: false,
    proportionKey: "icon",
    defaultProportion: 0.7,
  },
  {
    filename: "android-icon-foreground.png",
    canvasW: 512, canvasH: 512,
    description: "Android adaptive icon foreground (safe zone ~66% center)",
    keepAlpha: true,
    proportionKey: "android_adaptive",
    defaultProportion: 1 / 3,
  },
  {
    filename: "android-icon-background.png",
    canvasW: 512, canvasH: 512,
    description: "Android adaptive icon background (same size as foreground)",
    keepAlpha: false,
    proportionKey: "android_adaptive",
    defaultProportion: 1 / 3,
  },
  {
    filename: "android-icon-monochrome.png",
    canvasW: 432, canvasH: 432,
    description: "Android 13 Themed Icons — white silhouette on transparent (108dp × 4 = xxxhdpi)",
    keepAlpha: true,
    monochrome: true,
    proportionKey: "android_monochrome",
    defaultProportion: 1 / 3,
  },
  {
    filename: "splash-icon.png",
    canvasW: 1024, canvasH: 1024,
    description: "Splash screen image (expo-splash-screen plugin)",
    keepAlpha: true,
    proportionKey: "splash",
    defaultProportion: 0.5,
  },
  {
    filename: "favicon.png",
    canvasW: 48, canvasH: 48,
    description: "Web favicon",
    keepAlpha: true,
    proportionKey: "favicon",
    defaultProportion: 4 / 5,
  },
  {
    filename: "react-logo.png",
    canvasW: 100, canvasH: 100,
    description: "React logo @1x — decorative UI image",
    keepAlpha: true,
    proportionKey: "react_logo",
    defaultProportion: 4 / 5,
  },
  {
    filename: "react-logo@2x.png",
    canvasW: 200, canvasH: 200,
    description: "React logo @2x",
    keepAlpha: true,
    proportionKey: "react_logo",
    defaultProportion: 4 / 5,
  },
  {
    filename: "react-logo@3x.png",
    canvasW: 300, canvasH: 300,
    description: "React logo @3x",
    keepAlpha: true,
    proportionKey: "react_logo",
    defaultProportion: 4 / 5,
  },
  {
    filename: "partial-react-logo.png",
    canvasW: 518, canvasH: 316,
    description: "Partial react logo — right-side crop from top (landscape canvas)",
    keepAlpha: true,
    partial: true,
    proportionKey: "partial_logo",
    defaultProportion: 0.5,
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

// ─── Transformations ──────────────────────────────────────────────────────────

// Scales content to (canvasW * proportion) × (canvasH * proportion),
// centers it on the canvas, and applies background if keepAlpha is false.
export async function applyProportion(
  inputPath: string,
  canvasW: number,
  canvasH: number,
  proportion: number,
  keepAlpha: boolean,
  bg: { r: number; g: number; b: number }
): Promise<sharp.Sharp> {
  const contentW = Math.round(canvasW * proportion);
  const contentH = Math.round(canvasH * proportion);

  const contentBuf = await sharp(inputPath)
    .resize(contentW, contentH, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .png()
    .toBuffer();

  const meta = await sharp(contentBuf).metadata();
  const left = Math.round((canvasW - (meta.width ?? contentW)) / 2);
  const top  = Math.round((canvasH - (meta.height ?? contentH)) / 2);

  if (keepAlpha) {
    return sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: contentBuf, left, top }])
      .png();
  } else {
    return sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { ...bg, alpha: 1 } },
    })
      .composite([{ input: contentBuf, left, top }])
      .flatten({ background: bg })
      .png();
  }
}

// Converts every non-transparent pixel to pure white.
// Used for Android 13 Themed Icons — the system tints the silhouette.
export async function generateMonochrome(
  inputPath: string,
  canvasW: number,
  canvasH: number,
  proportion: number
): Promise<Buffer> {
  const contentW = Math.round(canvasW * proportion);
  const contentH = Math.round(canvasH * proportion);

  const { data, info } = await sharp(inputPath)
    .resize(contentW, contentH, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // pixel (r, g, b, a > 10)  →  (255, 255, 255, a)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] > 10) {
      data[i] = data[i + 1] = data[i + 2] = 255;
    }
  }

  const contentBuf = await sharp(Buffer.from(data), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  const left = Math.round((canvasW - info.width) / 2);
  const top  = Math.round((canvasH - info.height) / 2);

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: contentBuf, left, top }])
    .png()
    .toBuffer();
}

// Crops a section of the source image without distorting it.
// Takes the right-side section (final horizontal) from the top (start vertical).
// sectionFraction = 0.5 → right half, 0.33 → right third, etc.
export async function generatePartial(
  inputPath: string,
  canvasW: number,
  canvasH: number,
  sectionFraction: number
): Promise<Buffer> {
  const meta = await sharp(inputPath).metadata();
  const srcW = meta.width  ?? 1024;
  const srcH = meta.height ?? 1024;

  const cropW    = Math.round(srcW * sectionFraction);
  const cropH    = Math.round(srcH * sectionFraction);
  const cropLeft = srcW - cropW; // final horizontal → from the right
  const cropTop  = 0;            // start vertical   → from the top

  const cropped = await sharp(inputPath)
    .extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH })
    .ensureAlpha()
    .png()
    .toBuffer();

  const scaled = await sharp(cropped)
    .resize(canvasW, canvasH, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const scaledMeta = await sharp(scaled).metadata();
  const left = Math.round((canvasW - (scaledMeta.width  ?? canvasW)) / 2);
  const top  = Math.round((canvasH - (scaledMeta.height ?? canvasH)) / 2);

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: scaled, left, top }])
    .png()
    .toBuffer();
}

// ─── Main reusable function ───────────────────────────────────────────────────

export async function generateExpoAssets(
  inputImage: string,
  outputDir: string,
  options: GenerateOptions = {}
): Promise<GenerateResult> {
  const { backgroundColor, overwrite = true, proportions = {} } = options;

  fs.mkdirSync(outputDir, { recursive: true });

  const hasBg = !!backgroundColor;
  const bg    = hasBg ? hexToRgb(backgroundColor!) : { r: 0, g: 0, b: 0 };

  const generated: GeneratedFile[] = [];
  const errors:    string[]        = [];
  const skipped:   string[]        = [];

  for (const asset of EXPO_ASSETS) {
    const outputPath = path.join(outputDir, asset.filename);

    if (!overwrite && fs.existsSync(outputPath)) {
      skipped.push(asset.filename);
      continue;
    }

    const prop: number = proportions[asset.proportionKey] ?? asset.defaultProportion;

    try {
      if (asset.monochrome) {
        const buf = await generateMonochrome(inputImage, asset.canvasW, asset.canvasH, prop);
        fs.writeFileSync(outputPath, buf);
      } else if (asset.partial) {
        const buf = await generatePartial(inputImage, asset.canvasW, asset.canvasH, prop);
        fs.writeFileSync(outputPath, buf);
      } else {
        const pipeline = await applyProportion(
          inputImage, asset.canvasW, asset.canvasH, prop,
          asset.keepAlpha || !hasBg,
          bg
        );
        await pipeline.png({ compressionLevel: 9 }).toFile(outputPath);
      }

      generated.push({
        file: outputPath,
        canvas: `${asset.canvasW}×${asset.canvasH}`,
        proportion: Math.round(prop * 100) / 100,
        description: asset.description,
      });
    } catch (err) {
      errors.push(`${asset.filename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { generated, skipped, errors };
}
