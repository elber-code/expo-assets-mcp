#!/usr/bin/env node
/**
 * CLI script to generate all Expo assets from a source image.
 *
 * Usage:
 *   node dist/generate.js <image-path> [--bg #rrggbb] [--no-overwrite]
 *
 * Examples:
 *   node dist/generate.js /Users/me/logo.png
 *   node dist/generate.js /Users/me/logo.png --bg "#E6F4FE"
 *
 * Creates a folder next to the image with the same name (without extension):
 *   /Users/me/logo-assets/
 *     icon.png
 *     android-icon-foreground.png
 *     ...
 */

import * as path from "path";
import * as fs from "fs";
import { generateExpoAssets } from "./expo-assets.js";

// ─── Parse arguments ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
  console.log(`
Usage: node dist/generate.js <image-path> [options]

Options:
  --bg <#rrggbb>    Background color (default: transparent)
  --no-overwrite    Skip files that already exist

Example:
  node dist/generate.js /Users/me/logo.png --bg "#E6F4FE"
`);
  process.exit(0);
}

const inputImage  = path.resolve(args[0]);
const bgFlag      = args.indexOf("--bg");
const bgColor     = bgFlag !== -1 ? args[bgFlag + 1] : undefined;
const noOverwrite = args.includes("--no-overwrite");

// ─── Validate image ───────────────────────────────────────────────────────────
if (!fs.existsSync(inputImage)) {
  console.error(`Error: image not found: ${inputImage}`);
  process.exit(1);
}

// ─── Output folder: same directory, filename without extension + "-assets" ───
const basename  = path.basename(inputImage, path.extname(inputImage));
const outputDir = path.join(path.dirname(inputImage), `${basename}-assets`);

// ─── Generate ─────────────────────────────────────────────────────────────────
console.log(`\nGenerating Expo assets...`);
console.log(`  Source:     ${inputImage}`);
console.log(`  Output:     ${outputDir}`);
if (bgColor) console.log(`  Background: ${bgColor}`);
console.log();

generateExpoAssets(inputImage, outputDir, {
  backgroundColor: bgColor,
  overwrite: !noOverwrite,
})
  .then(({ generated, skipped, errors }) => {
    generated.forEach(f =>
      console.log(`  ✓  ${path.basename(f.file).padEnd(36)} ${f.canvas}  (prop: ${f.proportion})`)
    );
    if (skipped.length > 0) {
      console.log(`\n  Skipped (already exist):`);
      skipped.forEach(f => console.log(`  -  ${f}`));
    }
    if (errors.length > 0) {
      console.log(`\n  Errors:`);
      errors.forEach(e => console.log(`  ✗  ${e}`));
    }
    console.log(`\nDone: ${generated.length} files written to ${outputDir}\n`);
  })
  .catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
