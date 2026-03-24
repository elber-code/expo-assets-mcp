import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import { z } from "zod";
import { generateExpoAssets, hexToRgb } from "./expo-assets.js";

const server = new McpServer({
  name: "expo-assets-mcp",
  version: "1.0.0",
});

// ─── Tool 1: generate_expo_icons ──────────────────────────────────────────────
server.tool(
  "generate_expo_icons",
  "Generates all 10 Expo assets into assets/images/: icon, android adaptive (foreground/background/monochrome), splash, favicon, react-logo (@1x/@2x/@3x) and partial.",
  {
    input_image: z.string().describe(
      "Absolute path to the source image (transparent PNG recommended, minimum 1024×1024)"
    ),
    output_dir: z.string().describe(
      "Absolute path to the Expo project's assets/images/ folder"
    ),
    background_color: z.string().optional().describe(
      "Background color in hex (e.g. #E6F4FE). Omit for transparent background."
    ),
    overwrite: z.boolean().optional().default(true).describe(
      "Overwrite existing files (default: true)"
    ),
    proportions: z.object({
      icon:               z.number().min(0.1).max(1).optional().describe("icon.png — default 0.7"),
      android_adaptive:   z.number().min(0.1).max(1).optional().describe("android foreground + background — default 0.33"),
      android_monochrome: z.number().min(0.1).max(1).optional().describe("android monochrome — default 0.33"),
      splash:             z.number().min(0.1).max(1).optional().describe("splash-icon — default 0.5"),
      favicon:            z.number().min(0.1).max(1).optional().describe("favicon — default 0.8"),
      react_logo:         z.number().min(0.1).max(1).optional().describe("react-logo @1x/@2x/@3x — default 0.8"),
      partial_logo:       z.number().min(0.1).max(0.9).optional().describe("partial-react-logo — section fraction (0.5 = right half, 0.33 = right third)"),
    }).optional().describe("Content proportion per asset (0.1–1.0). Controls how much of the canvas the content fills."),
  },
  async ({ input_image, output_dir, background_color, overwrite, proportions }) => {
    if (!fs.existsSync(input_image)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Image not found: ${input_image}` }],
      };
    }

    const { generated, skipped, errors } = await generateExpoAssets(input_image, output_dir, {
      backgroundColor: background_color,
      overwrite: overwrite ?? true,
      proportions: proportions as Record<string, number> | undefined ?? {},
    });

    const assetsRelative = path.relative(
      path.dirname(output_dir.replace(/\/$/, "")),
      output_dir
    );

    const appJsonSnippet = {
      icon: `./${assetsRelative}/icon.png`,
      android: {
        adaptiveIcon: {
          foregroundImage: `./${assetsRelative}/android-icon-foreground.png`,
          backgroundImage: `./${assetsRelative}/android-icon-background.png`,
          monochromeImage: `./${assetsRelative}/android-icon-monochrome.png`,
          backgroundColor: background_color,
        },
      },
      web: { favicon: `./${assetsRelative}/favicon.png` },
      plugins: [
        "expo-router",
        ["expo-splash-screen", {
          image: `./${assetsRelative}/splash-icon.png`,
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: background_color,
        }],
      ],
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          generated_count:  generated.length,
          skipped_count:    skipped.length,
          errors_count:     errors.length,
          output_dir,
          files:            generated,
          skipped:          skipped.length > 0 ? skipped : undefined,
          errors:           errors.length  > 0 ? errors  : undefined,
          app_json_snippet: appJsonSnippet,
        }, null, 2),
      }],
    };
  }
);

// ─── Tool 2: transform_image ──────────────────────────────────────────────────
server.tool(
  "transform_image",
  "Transforms an image to the specified canvas dimensions with optional content proportion and background color.",
  {
    input_image:      z.string().describe("Absolute path to the source image (accepts PNG, JPEG, WebP, TIFF, AVIF)"),
    output_path:      z.string().describe("Absolute path of the output file, including name and extension (e.g. /path/to/result.webp)"),
    width:            z.number().int().positive().describe("Output canvas width in pixels"),
    height:           z.number().int().positive().describe("Output canvas height in pixels"),
    proportion:       z.number().optional().describe("How much of the canvas the content fills (0.1–1.0, default: 1 = fills everything)"),
    background_color: z.string().optional().describe("Canvas background color in hex (e.g. #ffffff). Omit for transparent background."),
    format:           z.enum(["png", "jpeg", "webp"]).optional().default("png").describe("Output file format (default: png)"),
    quality:          z.number().int().min(1).max(100).optional().default(95).describe("Output compression quality, only applies to jpeg and webp (1 = lowest, 100 = highest, default: 95)"),
  },
  async ({ input_image, output_path, width, height, proportion, background_color, format, quality }) => {
    if (!fs.existsSync(input_image)) {
      return {
        isError: true,
        content: [{ type: "text", text: `Image not found: ${input_image}` }],
      };
    }

    fs.mkdirSync(path.dirname(output_path), { recursive: true });

    const hasBg = !!background_color;
    const bg    = hasBg ? hexToRgb(background_color!) : { r: 0, g: 0, b: 0 };

    try {
      const prop     = (!proportion || proportion <= 0) ? 1 : Math.min(proportion, 1);
      const contentW = Math.round(width  * prop);
      const contentH = Math.round(height * prop);

      const contentBuf = await sharp(input_image)
        .resize(contentW, contentH, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .ensureAlpha()
        .png()
        .toBuffer();

      const meta = await sharp(contentBuf).metadata();
      const left = Math.round((width  - (meta.width  ?? contentW)) / 2);
      const top  = Math.round((height - (meta.height ?? contentH)) / 2);

      const canvas = sharp({
        create: {
          width, height, channels: 4,
          background: hasBg ? { ...bg, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
        },
      }).composite([{ input: contentBuf, left, top }]);

      const out = hasBg ? canvas.flatten({ background: bg }) : canvas;

      if (format === "jpeg")      await out.jpeg({ quality: quality ?? 95 }).toFile(output_path);
      else if (format === "webp") await out.webp({ quality: quality ?? 95 }).toFile(output_path);
      else                        await out.png({ compressionLevel: 9 }).toFile(output_path);

      const outMeta = await sharp(output_path).metadata();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            output:       output_path,
            canvas:       `${width}×${height}`,
            content_area: `${contentW}×${contentH}`,
            proportion:   prop,
            format,
            size_bytes:   outMeta.size,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);

// ─── Tool 3: convert_svg ──────────────────────────────────────────────────────
server.tool(
  "convert_svg",
  "Converts an SVG file to PNG, JPEG, or WebP at the specified dimensions. Supports multiple output sizes in a single call.",
  {
    input_svg: z.string().describe(
      "Absolute path to the source SVG file"
    ),
    output_path: z.string().describe(
      "Absolute path of the output file, including name and extension (e.g. /path/result.png)"
    ),
    width: z.number().int().positive().describe(
      "Output width in pixels"
    ),
    height: z.number().int().positive().optional().describe(
      "Output height in pixels. Omit to scale proportionally from width."
    ),
    format: z.enum(["png", "jpeg", "webp"]).optional().default("png").describe(
      "Output file format (default: png)"
    ),
    background_color: z.string().optional().describe(
      "Background color in hex (e.g. #ffffff). Omit for transparent (only works with png)."
    ),
    quality: z.number().int().min(1).max(100).optional().default(95).describe(
      "Compression quality for jpeg/webp only (1 = lowest, 100 = highest, default: 95)"
    ),
  },
  async ({ input_svg, output_path, width, height, format, background_color, quality }) => {
    if (!fs.existsSync(input_svg)) {
      return {
        isError: true,
        content: [{ type: "text", text: `SVG file not found: ${input_svg}` }],
      };
    }

    if (!input_svg.toLowerCase().endsWith(".svg")) {
      return {
        isError: true,
        content: [{ type: "text", text: `Input file must be an SVG: ${input_svg}` }],
      };
    }

    fs.mkdirSync(path.dirname(output_path), { recursive: true });

    try {
      const hasBg = !!background_color;
      const bg    = hasBg ? hexToRgb(background_color!) : { r: 0, g: 0, b: 0 };

      let pipeline = sharp(input_svg).resize(
        width,
        height ?? null,
        { fit: height ? "fill" : "outside", withoutEnlargement: false }
      );

      if (hasBg) {
        pipeline = pipeline.flatten({ background: bg });
      }

      if (format === "jpeg")      await pipeline.jpeg({ quality: quality ?? 95 }).toFile(output_path);
      else if (format === "webp") await pipeline.webp({ quality: quality ?? 95 }).toFile(output_path);
      else                        await pipeline.png({ compressionLevel: 9 }).toFile(output_path);

      const outMeta = await sharp(output_path).metadata();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            output:      output_path,
            width:       outMeta.width,
            height:      outMeta.height,
            format,
            size_bytes:  outMeta.size,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }
  }
);

// ─── Start server ─────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("expo-assets-mcp running — tools: generate_expo_icons, transform_image, convert_svg");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
