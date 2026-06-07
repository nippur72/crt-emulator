# @nippur72/crt-emulator

A high-performance WebGL-based CRT (Cathode-Ray Tube) screen emulator for simulating old color TV sets. This library applies scanlines, phosphor masks (shadow masks), composite PAL video chroma bleed, and tube curvature (warp) to simulate the visual aesthetic of retro computer and console emulators.

Originally written for [laser500emu](https://github.com/nippur72/laser500emu), this has been packaged as a standalone ESM library so it can be easily shared and integrated into other emulator projects.

## Features

- **Scanline Simulation**: Configurable scanline profile, from soft to retro sharp.
- **Phosphor Triad Shadow Mask**: Emulates the RGB phosphor triads of a CRT TV.
- **PAL Color Bleed**: Simulates the band-limited chroma components typical of composite PAL video signals.
- **Screen Curvature**: Warp options to simulate a curved tube face.
- **High Performance**: Written in TypeScript and uses WebGL shaders for hardware-accelerated rendering.

## Installation

```bash
npm install @nippur72/crt-emulator
```

## Quick Start

```typescript
import { CRTEmulator } from '@nippur72/crt-emulator';

const canvas = document.getElementById('my-canvas') as HTMLCanvasElement;
const crt = new CRTEmulator(canvas);

// Initialize WebGL context and shaders
const success = crt.init();

if (success) {
  console.log("WebGL CRT Emulation initialized!");
} else {
  console.warn("WebGL not supported. Fallback to standard 2D canvas context.");
}

// In your emulator frame rendering loop:
function drawFrame(imageData: ImageData) {
  if (crt.useWebGL) {
    // Render the screen with CRT effects
    crt.render(
      320,           // Source screen width in pixels
      240,           // Source screen height in pixels
      false,         // Double scanlines height (boolean)
      imageData,     // ImageData object containing raw frame buffer
      {
        warp: 0.04,  // Tube curvature
        hardScan: -6.0 // Scanline hardness
      }
    );
  } else {
    // Fallback drawing using 2d context
    const ctx = canvas.getContext('2d');
    if (ctx) {
       ctx.putImageData(imageData, 0, 0);
    }
  }
}
```

## API Reference

### `CRTEmulator`

#### `constructor(canvas: HTMLCanvasElement)`
Initializes the emulator bound to a canvas.

#### `init(): boolean`
Attempts to initialize WebGL (fallback to experimental-webgl if needed), loads the vertex and fragment shaders, compiles them, sets up buffers, and caches uniform locations.
- Returns `true` if successful, setting `useWebGL` to `true`.
- Returns `false` on failure (e.g., WebGL is not supported).

#### `render(SCREEN_W: number, SCREEN_H: number, doubleScanlines: boolean, imageData: ImageData, customOptions?: CRTEmulatorOptions): void`
Uploads the raw image data to the GPU and renders it to the viewport with the CRT shader applied.

### `CRTEmulatorOptions`

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `hardScan` | `number` | `-6.0` | Scanline sharpness/softness. Typical values: `-8.0` (soft), `-16.0` (medium), `-20.0` (sharp retro). |
| `hardPix` | `number` | `-2.0` | Horizontal pixel filter radius. Typical values: `-2.0` (soft), `-4.0` (sharp). |
| `warp` | `number` | `0.04` | Tube curvature warp factor. `0.0` is flat, higher values warp more. |
| `maskDark` | `number` | `0.5` | Shadow mask dark pixel scaling factor. |
| `maskLight` | `number` | `1.0` | Shadow mask light pixel scaling factor. |
| `maskScale` | `number` | `1.25` | Triad pattern size/density scaling factor. |
| `chromaBleed` | `number` | `1.0` | PAL signal color bleed simulation level. `0.0` (none), `1.0` (normal), `2.0` (strong). |
| `maskWidth` | `number` | `3.0` | Horizontal period/width of RGB triad phosphor in pixels. |
| `maskHeight` | `number` | `6.0` | Vertical height of RGB triad phosphor in pixels. |
| `gapWidth` | `number` | `0.25` | Vertical dark gap width between phosphors. |
| `gapHeight` | `number` | `0.5` | Horizontal dark gap height between phosphors. |

### `fsCRTSource(): string`
Helper function that returns the raw GLSL fragment shader source code, which can be useful if you're integrating this shader into your own custom WebGL pipeline.

## License

MIT
