# @nippur72/crt-emulator

A WebGL-based CRT (Cathode-Ray Tube) screen emulator library used for `@nippur72` web-based emulators.

The fragment shader emulates screen curvature, scanlines, an RGB phosphor shadow mask, and a
composite-video chroma path: band-limited colour bleed plus luma-to-chroma crosstalk
(the rainbow/colour fringing typical of 8-bit computers such as the C64 connected via
composite video).

## Usage

```ts
import { CRTEmulator } from "@nippur72/crt-emulator";

const crt = new CRTEmulator(canvas);
crt.init();

// every frame
crt.render(320, 200, false, imageData, {
  chromaBleed: 2.0,       // chroma smear radius in source pixels (0 = none)
  chromaPhase: 0.5,       // subcarrier cycles per source pixel (0.5 = NTSC, 0.625 = PAL)
  chromaCrosstalk: 0.5,   // luma -> chroma leakage, i.e. fringing strength (0..1)
});
```

All options are optional and merged with sensible defaults, see `CRTEmulatorOptions`
in `src/crt_emulation.ts`.

### Composite chroma options

- **`chromaBleed`** (default `2.0`) — radius in source pixels over which colour detail is
  smeared along the scanline. A TV's chroma path has far less bandwidth than its luma path,
  so saturated colours bleed ~1.5–3 pixels at 320-wide output while luminance stays sharp.
  `0` disables the bleed (fringing alone can still be enabled via `chromaCrosstalk`).
- **`chromaPhase`** (default `0.5`) — colour-subcarrier phase advance in cycles per source
  pixel. This is the ratio of subcarrier to pixel clock and controls the hue of the
  crosstalk fringes: `0.5` for NTSC (C64 US: 3.58 MHz / 7.16 MHz), `0.625` for PAL
  (C64 EU: 4.43 MHz / 7.09 MHz), `0` for a plain symmetric smear.
- **`chromaCrosstalk`** (default `0.5`) — luma-to-chroma leakage (0..1). Sharp luminance
  edges contain energy at the subcarrier frequency; a real TV decodes this as spurious
  colour, producing the alternating rainbow fringes on text and high-contrast edges.

## Interactive Control Panel

You can open a floating, draggable parameters window at any time by calling `window.crt_emulator()` in the console or from code:

```ts
// Opens the draggable parameters panel
window.crt_emulator();

// Or with initial values and a real-time change callback:
window.crt_emulator(currentOptions, (newOptions) => {
  // update rendering options
});
```

- **Draggable**: Drag the title bar to reposition anywhere on screen.
- **Always on top**: Floats above your application content.
- **Console output**: When closed, the current parameter object is printed to the console as JSON for easy copy-pasting.

## Demo

Run `npm run demo` from the repository root and open http://localhost:8080/demo/.
It serves the repo (the demo imports the built library from `dist/`) and renders a
C64-like 320×200 test frame with interactive sliders for all composite-chroma settings.
Rebuild first with `npm run build` after changing the shader.

You can also paste a screen copied from an emulator (e.g. a VICE screenshot):
focus the page and press `Ctrl+V` — the image is used as the emulator source,
and the canvas resizes to keep its aspect ratio. "reset demo frame" restores the
built-in test pattern.

## License

MIT
