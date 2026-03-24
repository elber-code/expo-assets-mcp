# expo-assets-mcp

Servidor MCP local para generar y transformar assets de Expo. Incluye un script CLI para usarlo directamente desde la terminal.

---

## Estructura del proyecto

```
src/
├── expo-assets.ts   ← lógica reutilizable (definición de assets, transformaciones)
├── index.ts         ← servidor MCP
└── generate.ts      ← script CLI
dist/                ← compilado (generado con npm run build)
```

---

## Instalación

```bash
npm install
npm run build
```

---

## Uso como CLI

Genera todos los assets de Expo a partir de una imagen fuente. Crea una carpeta junto a la imagen con el nombre `<imagen>-assets/`.

```bash
node dist/generate.js <ruta-imagen> [opciones]
```

**Opciones:**

| Flag | Descripción |
|---|---|
| `--bg "#rrggbb"` | Color de fondo. Sin valor = transparente |
| `--no-overwrite` | No sobreescribe archivos existentes |

**Ejemplos:**

```bash
# Fondo transparente
node dist/generate.js /Users/yo/logo.png

# Con color de fondo
node dist/generate.js /Users/yo/logo.png --bg "#E6F4FE"
```

**Resultado:**
```
/Users/yo/logo-assets/
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

## Uso como MCP (Claude Desktop)

Copia `claude-config.example.json` a `claude-config.json`, ajusta la ruta y agrégalo a:

`~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "expo-assets-mcp": {
      "command": "node",
      "args": ["/ruta/absoluta/a/expo-assets-mcp/dist/index.js"]
    }
  }
}
```

### Probar con MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

---

## Tools MCP disponibles

### `generate_expo_icons`

Genera los 10 assets de Expo en una sola carpeta `assets/images/`.

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `input_image` | string | — | Ruta absoluta a la imagen fuente |
| `output_dir` | string | — | Ruta absoluta a la carpeta `assets/images/` del proyecto Expo |
| `background_color` | string | transparente | Color de fondo en hex (ej: `#E6F4FE`). Sin valor = transparente. |
| `overwrite` | boolean | `true` | Sobreescribir archivos existentes |
| `proportions` | object | ver tabla | Proporción del contenido por asset (0.1–1.0) |

**Proporciones (`proportions`):**

| Clave | Asset(s) | Default |
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

Transforma una imagen a las dimensiones indicadas con proporción de contenido y fondo opcionales.

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `input_image` | string | — | Ruta a la imagen de entrada (acepta PNG, JPEG, WebP, TIFF, AVIF) |
| `output_path` | string | — | Ruta completa del archivo de salida, con nombre y extensión (ej: `/ruta/resultado.webp`) |
| `width` | number | — | Ancho del canvas de salida en píxeles |
| `height` | number | — | Alto del canvas de salida en píxeles |
| `proportion` | number | `1` | Qué fracción del canvas ocupa el contenido (0.1–1.0, 1 = llena todo) |
| `background_color` | string | transparente | Color de fondo del canvas en hex. Sin valor = transparente. |
| `format` | `png\|jpeg\|webp` | `png` | Formato del archivo de **salida** |
| `quality` | number | `95` | Calidad de compresión de salida, solo para jpeg/webp (1 = mínima, 100 = máxima) |

---

### `convert_svg`

Convierte un archivo SVG a PNG, JPEG o WebP en las dimensiones indicadas.

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `input_svg` | string | — | Ruta absoluta al archivo SVG fuente |
| `output_path` | string | — | Ruta completa del archivo de salida con nombre y extensión |
| `width` | number | — | Ancho de salida en píxeles |
| `height` | number | proporcional | Alto de salida en píxeles. Sin valor = escala proporcional al ancho. |
| `format` | `png\|jpeg\|webp` | `png` | Formato del archivo de salida |
| `background_color` | string | transparente | Color de fondo en hex. Sin valor = transparente (solo PNG). |
| `quality` | number | `95` | Calidad de compresión, solo para jpeg/webp (1 = mínima, 100 = máxima) |

---

## Assets generados

Expo genera todos los tamaños de plataforma automáticamente a partir de estos 10 archivos.

### Imagen fuente recomendada
- Formato: **PNG**
- Tamaño mínimo: **1024×1024 px**
- Fondo: **transparente** (recomendado)

### Tabla de assets

| Archivo | Canvas | Fondo | Transformación | Clave en app.json |
|---|---|---|---|---|
| `icon.png` | 1024×1024 | `background_color` o transparente | `contain` centrado, prop 0.7 | `expo.icon` |
| `android-icon-foreground.png` | 512×512 | Siempre transparente | `contain` centrado, prop 0.33 | `android.adaptiveIcon.foregroundImage` |
| `android-icon-background.png` | 512×512 | `background_color` o transparente | `contain` centrado, prop 0.33 | `android.adaptiveIcon.backgroundImage` |
| `android-icon-monochrome.png` | 432×432 | Siempre transparente | Silhouette blanca, prop 0.33 | `android.adaptiveIcon.monochromeImage` |
| `splash-icon.png` | 1024×1024 | Siempre transparente | `contain` centrado, prop 0.5 | `expo-splash-screen > image` |
| `favicon.png` | 48×48 | Siempre transparente | `contain` centrado, prop 0.8 | `web.favicon` |
| `react-logo.png` | 100×100 | Siempre transparente | `contain` centrado, prop 0.8 | UI decorativa @1x |
| `react-logo@2x.png` | 200×200 | Siempre transparente | `contain` centrado, prop 0.8 | UI decorativa @2x |
| `react-logo@3x.png` | 300×300 | Siempre transparente | `contain` centrado, prop 0.8 | UI decorativa @3x |
| `partial-react-logo.png` | 518×316 | Siempre transparente | Crop lado derecho desde arriba, prop 0.5 | UI decorativa parcial |

### Transformaciones especiales

#### `android-icon-monochrome.png` — Silhouette blanca
Cada píxel no transparente se convierte a blanco puro. Android 13+ usa este archivo para *Themed Icons*, aplicando el color del tema del sistema sobre la silhouette.

```
pixel (r, g, b, a > 10)  →  (255, 255, 255, a)
pixel (r, g, b, a ≤ 10)  →  sin cambio (transparente)
```

#### `partial-react-logo.png` — Crop de sección
Se toma una sección de la imagen original sin deformarla:
- **Horizontal:** lado derecho (final)
- **Vertical:** desde arriba (inicio)
- La sección se escala proporcionalmente para caber en el canvas 518×316

`partial_logo: 0.5` → mitad derecha · `partial_logo: 0.33` → tercio derecho

#### Android adaptive icon — Safe zone

El contenido importante debe estar dentro del **66% central** del canvas (338×338 px en 512×512) para no ser recortado por ningún launcher de Android.

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
npm run build   # compilar TypeScript
npm start       # iniciar servidor MCP
npm run dev     # desarrollo con tsx (sin compilar)
```
