/**
 * Original shader taken from https://www.shadertoy.com/view/XsjSzR
 * Improved with a better RGB mask and a composite-video chroma simulation
 * (band-limited colour bleed + luma-to-chroma crosstalk fringing).
 */

/**
 * Configuration options for the CRT Emulator to customize the visual effect.
 */
export interface CRTEmulatorOptions {
   /**
    * Scanline sharpness/softness.
    * - Typical values:
    *   - -8.0  = Soft scanlines
    *   - -16.0 = Medium scanlines
    *   - -20.0 = Sharp retro scanlines
    * @default -6.0
    */
   hardScan?: number;

   /**
    * Horizontal pixel sharpness/softness (filter radius).
    * - Typical values:
    *   - -2.0 = Soft pixels
    *   - -4.0 = Hard/sharp pixels
    * @default -2.0
    */
   hardPix?: number;

   /**
    * Curvature/warp factor of the CRT screen.
    * - Set to 0.0 for a flat screen.
    * - Higher values increase curvature.
    * @default 0.04
    */
   warp?: number;

   /**
    * Shadow mask dark pixel scale factor.
    * Adjusts the intensity of the dark lines/areas in the phosphor shadow mask.
    * @default 0.5
    */
   maskDark?: number;

   /**
    * Shadow mask light pixel scale factor.
    * Adjusts the brightness of the active/lit phosphor subpixels.
    * @default 1.0
    */
   maskLight?: number;

   /**
    * Triad (phosphor mask) scale factor.
    * Controls the size/density of the shadow mask triad pattern on the screen.
    * @default 1.25
    */
   maskScale?: number;

   /**
    * Chroma (color) bleed radius, in source pixels (texels).
    * The TV receiver's chroma path has much less bandwidth than its luma path,
    * so colour detail smears horizontally across roughly this many source pixels
    * while luminance stays sharp. At 320-pixel-wide 8-bit output (e.g. C64)
    * a radius of ~1.5-3.0 reproduces the classic composite look.
    * - 0.0 = None (perfect RGB signal)
    * - 1.0 = Mild bleed
    * - 2.0 = Normal composite bleed (C64-like)
    * - 3.0+ = Strong bleed
    * @default 2.0
    */
   chromaBleed?: number;

   /**
    * Colour subcarrier phase advance, in cycles per source pixel (texel).
    * This is the ratio of the colour subcarrier frequency to the pixel clock,
    * which drives the hue of the luma-to-chroma crosstalk fringes.
    * - 0.0    = No phase effect (plain symmetric smear)
    * - 0.5    = NTSC (C64 US: 3.58 MHz subcarrier / 7.16 MHz pixel clock)
    * - 0.625  = PAL (C64 EU: 4.43 MHz subcarrier / 7.09 MHz pixel clock)
    * @default 0.5
    */
   chromaPhase?: number;

   /**
    * Luma-to-chroma crosstalk level (0.0 - 1.0).
    * Sharp luminance edges (e.g. text) contain energy at the colour subcarrier
    * frequency; a real TV decodes this as spurious colour, producing the
    * characteristic rainbow/colour fringing on high-contrast edges.
    * - 0.0 = No fringing
    * - 0.5 = Strong fringing (C64-like)
    * @default 0.5
    */
   chromaCrosstalk?: number;

   /**
    * Horizontal period/width of the RGB triad element in pixels.
    * @default 3.0
    */
   maskWidth?: number;

   /**
    * Vertical height of the RGB triad element in pixels.
    * @default 6.0
    */
   maskHeight?: number;

   /**
    * Vertical dark column gap width between phosphors.
    * @default 0.25
    */
   gapWidth?: number;

   /**
    * Horizontal dark row gap height between phosphors.
    * @default 0.5
    */
   gapHeight?: number;

   /**
    * Dynamic mask fading factor on bright pixels.
    * - 0.0 = No fading (constant mask strength)
    * - 1.0 = Max fading (mask disappears entirely on white pixels)
    * @default 0.9
    */
   maskFade?: number;

   /**
    * Beam convergence error in output pixels.
    * Simulates misconverged RGB guns: red is displaced left, blue right of
    * green, producing colour fringes on sharp edges (classic un-calibrated
    * colour TV look).
    * @default 0.0
    */
   convergence?: number;

   /**
    * Corner radius of the screen glass, as a fraction of the screen's
    * shorter edge (0.0 - 0.5). Rounds the corners of the displayed image to
    * mimic the rounded corners of an old CRT tube; the outside is darkened
    * to black. 0 disables the rounding.
    * @default 0.08
    */
   cornerRadius?: number;

   /**
    * Horizontal sync jitter amplitude, in output pixels.
    * Displaces each scanline by a small random amount that varies over time,
    * mimicking imperfect horizontal synchronisation on marginal signals.
    * @default 0.0
    */
   jitter?: number;

   /**
    * Phosphor mask geometry.
    * - "slot": staggered RGB slots with dark gaps between rows and columns
    *   (typical of late-model colour TVs and CRT monitors).
    * - "grille": continuous vertical RGB stripes (aperture grille).
    * - "delta": staggered triads whose RGB order rotates every phosphor row
    *   (delta-gun shadow mask, typical of early colour TV sets).
    * @default "slot"
    */
   maskType?: "slot" | "grille" | "delta";

   /**
    * Phosphor persistence / afterglow level (0.0 - 0.95).
    * Bright areas fade out gradually instead of disappearing instantly,
    * like a real tube's phosphor decay. Requires a multipass render path;
    * 0 keeps the fast single-pass path.
    * @default 0.0
    */
   persistence?: number;

   /**
    * Bloom / glow strength (0.0 - 1.0).
    * Bright areas bleed a soft halo onto the surrounding screen, caused by
    * electron beam spread and glass reflections. Requires a multipass
    * render path; 0 keeps the fast single-pass path.
    * @default 0.0
    */
   bloom?: number;
}

/**
 * Default options applied when rendering if no custom options are provided,
 * or used to fill in missing properties in user-supplied options.
 */
export const DEFAULT_OPTIONS: Required<CRTEmulatorOptions> = {
   hardScan: -6.0,
   hardPix: -2.0,
   warp: 0.04,
   maskDark: 0.5,
   maskLight: 1.0,
   maskScale: 1.25,
   chromaBleed: 2.0,
   chromaPhase: 0.5,
   chromaCrosstalk: 0.5,
   maskWidth: 3.0,
   maskHeight: 6.0,
   gapWidth: 0.25,
   gapHeight: 0.5,
   maskFade: 0.9,
   convergence: 0.0,
   cornerRadius: 0.08,
   jitter: 0.0,
   maskType: "slot",
   persistence: 0.0,
   bloom: 0.0,
};

/**
 * Internal interface to store compiled WebGL uniform locations and
 * cached vertex attribute locations.
 */
interface CRTEmulatorUniforms {
   uSampler: WebGLUniformLocation | null;
   uResolution: WebGLUniformLocation | null;
   uTextureResolution: WebGLUniformLocation | null;
   uHardScan: WebGLUniformLocation | null;
   uHardPix: WebGLUniformLocation | null;
   uWarp: WebGLUniformLocation | null;
   uMaskDark: WebGLUniformLocation | null;
   uMaskLight: WebGLUniformLocation | null;
   uMaskScale: WebGLUniformLocation | null;
   uChromaBleed: WebGLUniformLocation | null;
   uChromaPhase: WebGLUniformLocation | null;
   uChromaCrosstalk: WebGLUniformLocation | null;
   uMaskWidth: WebGLUniformLocation | null;
   uMaskHeight: WebGLUniformLocation | null;
   uGapWidth: WebGLUniformLocation | null;
   uGapHeight: WebGLUniformLocation | null;
   uMaskFade: WebGLUniformLocation | null;
   uConvergence: WebGLUniformLocation | null;
   uCornerRadius: WebGLUniformLocation | null;
   uJitter: WebGLUniformLocation | null;
   uTime: WebGLUniformLocation | null;
   uMaskType: WebGLUniformLocation | null;
   aPosition: number;
   aTexCoord: number;
}

/**
 * Shared GLSL library used by every fragment program: gamma helpers, YUV
 * conversion, resampler, composite chroma path, warp and shadow mask.
 */
const fsLibSource = `
      precision highp float;
      varying vec2 vTexCoord;
      uniform sampler2D uSampler;
      uniform vec2 uResolution;
      uniform vec2 uTextureResolution;

      uniform float uHardScan;
      uniform float uHardPix;
      uniform vec2 uWarp;
      uniform float uMaskDark;
      uniform float uMaskLight;
      uniform float uMaskScale;
      uniform float uChromaBleed;
      uniform float uChromaPhase;
      uniform float uChromaCrosstalk;
      uniform float uMaskWidth;
      uniform float uMaskHeight;
      uniform float uGapWidth;
      uniform float uGapHeight;
      uniform float uMaskFade;
      uniform float uConvergence;
      uniform float uCornerRadius;
      uniform float uJitter;
      uniform float uTime;
      uniform int uMaskType;

      // sRGB to Linear.
      // Assuming using sRGB typed textures this should not be needed.
      float ToLinear1(float c) {
         return (c <= 0.04045) ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
      }
      vec3 ToLinear(vec3 c) {
         return vec3(ToLinear1(c.r), ToLinear1(c.g), ToLinear1(c.b));
      }

      // Linear to sRGB.
      // Assuming using sRGB typed textures this should not be needed.
      float ToSrgb1(float c) {
         return (c < 0.0031308 ? c * 12.92 : 1.055 * pow(c, 0.41666) - 0.055);
      }
      vec3 ToSrgb(vec3 c) {
         return vec3(ToSrgb1(c.r), ToSrgb1(c.g), ToSrgb1(c.b));
      }

      // RGB to YUV conversion (Composite PAL/NTSC signal simulation)
      vec3 RGBtoYUV(vec3 rgb) {
         float y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
         float u = -0.14713 * rgb.r - 0.28886 * rgb.g + 0.436 * rgb.b;
         float v = 0.615 * rgb.r - 0.51499 * rgb.g - 0.10001 * rgb.b;
         return vec3(y, u, v);
      }

      // YUV to RGB conversion
      vec3 YUVtoRGB(vec3 yuv) {
         float r = yuv.x + 1.13983 * yuv.z;
         float g = yuv.x - 0.39465 * yuv.y - 0.58060 * yuv.z;
         float b = yuv.x + 2.03211 * yuv.y;
         return vec3(r, g, b);
      }

      // Nearest emulated sample given floating point position and texel offset.
      // Also zero's off screen.
      vec3 Fetch(vec2 pos, vec2 off) {
         vec2 texCoord = (floor(pos * uTextureResolution + off) + vec2(0.5)) / uTextureResolution;
         if (max(abs(texCoord.x - 0.5), abs(texCoord.y - 0.5)) > 0.5) return vec3(0.0, 0.0, 0.0);
         return ToLinear(texture2D(uSampler, texCoord).rgb);
      }

      // ----------------------------------------------------------------------
      // Composite-video chroma simulation.
      // Models the chroma path of a PAL/NTSC receiver along the scanline:
      //   1) chroma low-pass filtering  -> colour bleeding/smearing
      //   2) luma-to-chroma crosstalk    -> rainbow fringing on sharp edges
      // Keeps the sharp resampled luminance and replaces the chroma only.
      // ----------------------------------------------------------------------
      vec3 ApplyComposite(vec3 sharpColor, vec2 pos) {
         // Fractional source-texel position of this output pixel
         vec2 center = pos * uTextureResolution;
         float cx = center.x;
         float cy = floor(center.y) + 0.5;

         // Window radius and Gaussian sigma, in source texels.
         // The kernel grows continuously from zero effect at uChromaBleed = 0.
         float radius = max(uChromaBleed, 0.05);
         float sigma = max(uChromaBleed, 0.05) * 0.55;

         // Subcarrier phase advance per source texel, in radians.
         float phaseStep = 6.28318530718 * uChromaPhase;
         // Without a subcarrier there is no hue to demodulate against:
         // disable the directional fringing (a plain symmetric smear remains).
         float fringeAmt = (abs(uChromaPhase) < 1e-4) ? 0.0 : uChromaCrosstalk;
         // Reference phase: continuous across the scanline plus the ~180 deg
         // line-to-line alternation common to NTSC and PAL colour frames.
         float refPhase = phaseStep * cx + 3.14159265358979 * mod(floor(center.y), 2.0);

         // Bilinearly sampled centre luma (the crosstalk reference)
         vec2 uvCenter = vec2(clamp(cx / uTextureResolution.x, 0.0, 1.0), clamp(cy / uTextureResolution.y, 0.0, 1.0));
         float yCenter = RGBtoYUV(ToLinear(texture2D(uSampler, uvCenter).rgb)).x;

         vec2 chroma = vec2(0.0);
         vec2 fringe = vec2(0.0);
         float lumaAvg = 0.0;
         float sumW = 0.0;

         // Constant loop bounds are required by GLSL ES 1.00 (WebGL 1).
         // Taps outside the requested radius are skipped.
         for (int i = 0; i <= 10; i++) {
            float d = float(i) - 5.0;
            if (abs(d) > radius) continue;

            vec2 uv = vec2(clamp((cx + d) / uTextureResolution.x, 0.0, 1.0), uvCenter.y);
            vec3 yuv = RGBtoYUV(ToLinear(texture2D(uSampler, uv).rgb));

            // Band-limit the chroma: colour bleeds across the window.
            // A small negative lobe (Gaussian minus a narrower Gaussian)
            // reproduces the mild chroma ringing/overshoot real composite
            // decoders show at colour transitions.
            float w = exp(-0.5 * (d / sigma) * (d / sigma))
                    - 0.5 * exp(-0.5 * (d / (sigma * 0.5)) * (d / (sigma * 0.5)));
            chroma += w * yuv.yz;
            lumaAvg += w * yuv.x;

            // Luma-to-chroma crosstalk: luma deviation demodulated against the
            // colour subcarrier. The hue follows the (locked) subcarrier phase,
            // producing the alternating rainbow fringes seen on composite video.
            float ph = refPhase + phaseStep * d;
            fringe += w * (yuv.x - yCenter) * vec2(cos(ph), sin(ph));
            sumW += w;
         }
         chroma /= max(sumW, 1e-6);
         fringe /= max(sumW, 1e-6);
         lumaAvg /= max(sumW, 1e-6);

         // Keep the sharp luminance from the resampler; replace the chroma with
         // the band-limited version and add the crosstalk fringes.
         vec3 yuvSharp = RGBtoYUV(sharpColor);

         // The sharp luminance already carries the scanline/resampling
         // modulation from Tri(); apply the same factor to the window chroma
         // so flat areas keep a consistent brightness.
         float modGain = yuvSharp.x / max(lumaAvg, 1e-4);
         modGain = clamp(modGain, 0.0, 4.0);

         vec2 composite = (chroma + fringeAmt * fringe) * modGain;
         vec2 finalChroma = (uChromaBleed > 0.0)
            ? composite
            : yuvSharp.yz + fringeAmt * fringe * modGain;
         return YUVtoRGB(vec3(yuvSharp.x, finalChroma));
      }

      // Distance in emulated pixels to nearest texel.
      vec2 Dist(vec2 pos) {
         pos = pos * uTextureResolution;
         return -((pos - floor(pos)) - vec2(0.5));
      }
          
      // 1D Gaussian.
      float Gaus(float pos, float scale) {
         return exp2(scale * pos * pos);
      }

      // 3-tap Gaussian filter along horz line.
      vec3 Horz3(vec2 pos, float off) {
         vec3 b = Fetch(pos, vec2(-1.0, off));
         vec3 c = Fetch(pos, vec2( 0.0, off));
         vec3 d = Fetch(pos, vec2( 1.0, off));
         float dst = Dist(pos).x;
         // Convert distance to weight.
         float scale = uHardPix;
         float wb = Gaus(dst - 1.0, scale);
         float wc = Gaus(dst + 0.0, scale);
         float wd = Gaus(dst + 1.0, scale);
         // Return filtered sample.
         return (b * wb + c * wc + d * wd) / (wb + wc + wd);
      }

      // 5-tap Gaussian filter along horz line.
      vec3 Horz5(vec2 pos, float off) {
         vec3 a = Fetch(pos, vec2(-2.0, off));
         vec3 b = Fetch(pos, vec2(-1.0, off));
         vec3 c = Fetch(pos, vec2( 0.0, off));
         vec3 d = Fetch(pos, vec2( 1.0, off));
         vec3 e = Fetch(pos, vec2( 2.0, off));
         float dst = Dist(pos).x;
         // Convert distance to weight.
         float scale = uHardPix;
         float wa = Gaus(dst - 2.0, scale);
         float wb = Gaus(dst - 1.0, scale);
         float wc = Gaus(dst + 0.0, scale);
         float wd = Gaus(dst + 1.0, scale);
         float we = Gaus(dst + 2.0, scale);
         // Return filtered sample.
         return (a * wa + b * wb + c * wc + d * wd + e * we) / (wa + wb + wc + wd + we);
      }

      // Return scanline weight.
      float Scan(vec2 pos, float off) {
         float dst = Dist(pos).y;
         return Gaus(dst + off, uHardScan);
      }

      // Allow nearest three lines to effect pixel.
      vec3 Tri(vec2 pos) {
         vec3 a = Horz3(pos, -1.0);
         vec3 b = Horz5(pos,  0.0);
         vec3 c = Horz3(pos,  1.0);
         float wa = Scan(pos, -1.0);
         float wb = Scan(pos,  0.0);
         float wc = Scan(pos,  1.0);
         return a * wa + b * wb + c * wc;
      }

      // Distortion of scanlines, and end of screen alpha.
      vec2 Warp(vec2 pos) {
         pos = pos * 2.0 - 1.0;
         pos *= vec2(1.0 + (pos.y * pos.y) * uWarp.x, 1.0 + (pos.x * pos.x) * uWarp.y);
         return pos * 0.5 + 0.5;
      }

      // 1 inside the rounded CRT screen glass, 0 outside the corner radius.
      // Darkens the outside corners to black, mimicking an old curved tube.
      float CornerShade(vec2 pos) {
         vec2 aspect = uResolution / min(uResolution.x, uResolution.y);
         vec2 p = (pos * 2.0 - 1.0) * aspect;
         float r = uCornerRadius * 2.0;
         if (r <= 0.0) return 1.0;
         // Signed distance to a rounded rectangle with half-size = aspect
         // and corner radius r (short edge spans -1..1, i.e. length 2).
         vec2 q = abs(p) - aspect + r;
         float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
#ifdef HAS_DERIVATIVES
         float aa = fwidth(d);
#else
         float aa = 0.015;
#endif
         return 1.0 - smoothstep(-aa, aa, d);
      }

      // 1D hash for per-scanline jitter (sin-free, stable across GPUs).
      float hash11(float p) {
         p = fract(p * 0.1031);
         p *= p + 33.33;
         p *= p + p;
         return fract(p);
      }

      // Shadow mask.
      // uMaskType: 0 = slot (staggered slots), 1 = grille (vertical stripes),
      // 2 = delta (triads with per-row rotating RGB order).
      vec3 Mask(vec2 pos) {
         pos = pos / uMaskScale;

#ifdef HAS_DERIVATIVES
         vec2 d = fwidth(pos);
         float maxD = max(d.x / uMaskWidth, d.y / uMaskHeight);
         float blend = smoothstep(0.3, 0.8, maxD);
#else
         float blend = 0.0;
#endif

         // Calculate average mask color (used when the grid falls below Nyquist)
         float activeArea = (uMaskWidth - uGapWidth) * (uMaskHeight - uGapHeight) / (uMaskWidth * uMaskHeight);
         vec3 maskAvg = activeArea * vec3((uMaskLight + 2.0 * uMaskDark) / 3.0) + (1.0 - activeArea) * vec3(uMaskDark);

         // Stagger every other column of the mask grid (slot and delta only).
         float col = floor(pos.x / uMaskWidth);
         float y = pos.y + (uMaskType != 1 ? mod(col, 2.0) * (uMaskHeight / 2.0) : 0.0);

         // Delta-gun: the RGB order rotates every triad row.
         float rowIdx = floor(y / uMaskHeight);
         float channelShift = (uMaskType == 2) ? mod(rowIdx, 3.0) : 0.0;

         float xMod = mod(pos.x, uMaskWidth);
         float yMod = mod(y, uMaskHeight);

         float activeWidth = uMaskWidth - uGapWidth;
         float activeHeight = uMaskHeight - uGapHeight;
         float subW = activeWidth / 3.0;
         // Grille (aperture) stripes run to the cell edge with no right gap;
         // slot/delta keep the dark column between triads.
         bool hasGap = (uMaskType != 1);
         float rightEdge = hasGap ? activeWidth : uMaskWidth;

         // Anti-aliasing half-widths, capped so they never blend away the
         // narrow mesh gaps. Interior subpixel boundaries may soften more
         // (they're wide colour transitions), but gap edges stay nearly crisp
         // so the dark separation remains visible.
#ifdef HAS_DERIVATIVES
         float aaX   = max(min(d.x, 0.5 * subW), 1e-5);
         float aaGap = max(min(d.x, 0.3 * uGapWidth), 1e-5);
         float aaY   = max(min(d.y, 0.3 * uGapHeight), 1e-5);
#else
         float aaX   = 0.4 * subW;
         float aaGap = 0.3 * uGapWidth;
         float aaY   = 0.3 * uGapHeight;
#endif

         // Anti-aliased coverage of each subpixel span along x.
         float covL = (hasGap ? smoothstep(0.0, aaGap, xMod) : 1.0)
                    * (1.0 - smoothstep(subW - aaX, subW + aaX, xMod));
         float covM = smoothstep(subW - aaX, subW + aaX, xMod)
                    * (1.0 - smoothstep(2.0 * subW - aaX, 2.0 * subW + aaX, xMod));
         float covR = smoothstep(2.0 * subW - aaX, 2.0 * subW + aaX, xMod)
                    * (hasGap ? (1.0 - smoothstep(rightEdge - aaGap, rightEdge + aaGap, xMod)) : 1.0);

         // Route each span's coverage to the colour channel it excites.
         vec3 chan = vec3(0.0);
         float s0 = channelShift;
         if (s0 < 0.5) chan.r += covL;
         else if (s0 < 1.5) chan.g += covL;
         else chan.b += covL;
         float s1 = mod(channelShift + 1.0, 3.0);
         if (s1 < 0.5) chan.r += covM;
         else if (s1 < 1.5) chan.g += covM;
         else chan.b += covM;
         float s2 = mod(channelShift + 2.0, 3.0);
         if (s2 < 0.5) chan.r += covR;
         else if (s2 < 1.5) chan.g += covR;
         else chan.b += covR;

         vec3 mask = mix(vec3(uMaskDark), vec3(uMaskLight), chan);

         // Slot-only horizontal dark row gap, softly crossed at its boundary.
         if (uMaskType != 1 && uMaskType != 2) {
            float rowOn = 1.0 - smoothstep(activeHeight - aaY, activeHeight + aaY, yMod);
            mask *= rowOn;
         }

         return mix(mask, maskAvg, blend);
      }
   `;

/**
 * Legacy single-pass program: complete CRT image in one draw.
 * Kept bit-identical to the pre-multipass behaviour.
 */
const fsCRTSource = fsLibSource + `
      void main(void) {
         vec2 pos = Warp(vTexCoord);

         // Horizontal sync jitter: displace each scanline by a pseudo-random
         // amount, changing over time.
         if (uJitter > 0.0) {
            float lineIdx = floor(pos.y * uTextureResolution.y);
            pos.x += (hash11(lineIdx + floor(uTime * 13.0)) - 0.5) * uJitter / uResolution.x;
         }

         vec3 rawColor;
         if (uConvergence > 0.0) {
            // Beam convergence error: red sampled left of green, blue right,
            // producing colour fringes on sharp vertical edges.
            float conv = uConvergence / uResolution.x;
            float r = Tri(vec2(pos.x - conv, pos.y)).r;
            float g = Tri(pos).g;
            float b = Tri(vec2(pos.x + conv, pos.y)).b;
            rawColor = vec3(r, g, b);
         } else {
            rawColor = Tri(pos);
         }

         // Composite chroma processing (bleed + fringing), one pass per pixel.
         if (uChromaBleed > 0.0 || uChromaCrosstalk > 0.0) {
            rawColor = ApplyComposite(rawColor, pos);
         }

         vec3 maskVal = Mask(pos * uResolution);

         // Calculate luminance using standard weights
         float luma = dot(rawColor, vec3(0.299, 0.587, 0.114));

         // Fade the mask towards 1.0 (white/no mask) on bright areas
         vec3 dynamicMask = mix(maskVal, vec3(1.0), luma * uMaskFade);

         vec3 color = rawColor * dynamicMask;

         // Rounded CRT glass corners: darken outside the radius.
         color *= CornerShade(pos);

         gl_FragColor = vec4(ToSrgb(color), 1.0);
      }
   `;

/**
 * Multipass "scene" program: everything up to and including the composite
 * chroma path, output in linear light WITHOUT mask/corner/gamma.
 */
const fsSceneSource = fsLibSource + `
      void main(void) {
         vec2 pos = Warp(vTexCoord);

         if (uJitter > 0.0) {
            float lineIdx = floor(pos.y * uTextureResolution.y);
            pos.x += (hash11(lineIdx + floor(uTime * 13.0)) - 0.5) * uJitter / uResolution.x;
         }

         vec3 rawColor;
         if (uConvergence > 0.0) {
            float conv = uConvergence / uResolution.x;
            float r = Tri(vec2(pos.x - conv, pos.y)).r;
            float g = Tri(pos).g;
            float b = Tri(vec2(pos.x + conv, pos.y)).b;
            rawColor = vec3(r, g, b);
         } else {
            rawColor = Tri(pos);
         }

         if (uChromaBleed > 0.0 || uChromaCrosstalk > 0.0) {
            rawColor = ApplyComposite(rawColor, pos);
         }

         gl_FragColor = vec4(rawColor, 1.0);
      }
   `;

/**
 * Multipass "present" program: mask + rounded corners + bloom add + gamma encode.
 */
const fsPresentSource = fsLibSource + `
      uniform sampler2D uScene;      // linear-light scene (post-chroma)
      uniform sampler2D uBloom;      // blurred bright pass (linear light)
      uniform float uBloomAmount;

      void main(void) {
         vec2 pos = Warp(vTexCoord);

         vec3 sceneLinear = texture2D(uScene, vTexCoord).rgb;
         vec3 bloom = texture2D(uBloom, vTexCoord).rgb;

         vec3 rawColor = sceneLinear + uBloomAmount * bloom;

         vec3 maskVal = Mask(pos * uResolution);
         float luma = dot(rawColor, vec3(0.299, 0.587, 0.114));
         vec3 dynamicMask = mix(maskVal, vec3(1.0), luma * uMaskFade);
         vec3 color = rawColor * dynamicMask;

         // Rounded CRT glass corners: darken outside the radius.
         color *= CornerShade(pos);

         gl_FragColor = vec4(ToSrgb(color), 1.0);
      }
   `;

/**
 * Persistence accumulation program: accum = max(cur, prev * decay).
 * Runs in linear light on ping-pong buffers.
 */
const fsAccumSource = `
      precision highp float;
      varying vec2 vTexCoord;
      uniform sampler2D uCur;
      uniform sampler2D uPrev;
      uniform float uDecay;

      void main(void) {
         vec3 cur = texture2D(uCur, vTexCoord).rgb;
         vec3 prev = texture2D(uPrev, vTexCoord).rgb;
         gl_FragColor = vec4(max(cur, prev * uDecay), 1.0);
      }
   `;

/** Bloom bright-pass: keeps energy above a linear threshold. */
const fsBrightPassSource = `
      precision highp float;
      varying vec2 vTexCoord;
      uniform sampler2D uTex;

      void main(void) {
         vec3 c = texture2D(uTex, vTexCoord).rgb;
         float luma = dot(c, vec3(0.299, 0.587, 0.114));
         float k = max(luma - 0.7, 0.0) / max(luma, 1e-4);
         gl_FragColor = vec4(c * k, 1.0);
      }
   `;

/** Separable Gaussian blur used by the two bloom blur passes. */
const fsBlurSource = `
      precision highp float;
      varying vec2 vTexCoord;
      uniform sampler2D uTex;
      uniform vec2 uTexel;      // 1/resolution along the blur axis

      void main(void) {
         vec3 sum = texture2D(uTex, vTexCoord).rgb * 0.2270270270;
         vec2 o1 = uTexel * 1.3846153846;
         vec2 o2 = uTexel * 3.2307692308;
         sum += (texture2D(uTex, vTexCoord + o1).rgb + texture2D(uTex, vTexCoord - o1).rgb) * 0.3162162162;
         sum += (texture2D(uTex, vTexCoord + o2).rgb + texture2D(uTex, vTexCoord - o2).rgb) * 0.1081081081;
         gl_FragColor = vec4(sum, 1.0);
      }
   `;

/**
 * Controller class to handle WebGL lifecycle and rendering for CRT simulation.
 * It expects a canvas element, sets up buffers and shaders, updates textures with input frames,
 * and renders the final frame with retro effects like scanlines and CRT curvature.
 */
export class CRTEmulator {
   private gl: WebGLRenderingContext | null = null;
   private glProgramCRT: WebGLProgram | null = null;
   private glVertexBuffer: WebGLBuffer | null = null;
   private glTex: WebGLTexture | null = null;
   private uniforms: CRTEmulatorUniforms | null = null;
   private hasDerivatives = false;

   // Multipass resources (created lazily when persistence/bloom are used)
   private progScene: WebGLProgram | null = null;
   private progPresent: WebGLProgram | null = null;
   private progAccum: WebGLProgram | null = null;
   private progBright: WebGLProgram | null = null;
   private progBlur: WebGLProgram | null = null;
   private uScene: Record<string, WebGLUniformLocation | null> = {};
   private uPresent: Record<string, WebGLUniformLocation | null> = {};
   private uAccum: Record<string, WebGLUniformLocation | null> = {};
   private uBright: Record<string, WebGLUniformLocation | null> = {};
   private uBlur: Record<string, WebGLUniformLocation | null> = {};
   private fboScene: WebGLFramebuffer | null = null;
   private texScene: WebGLTexture | null = null;
   private fboAccum: [WebGLFramebuffer | null, WebGLFramebuffer | null] = [null, null];
   private texAccum: [WebGLTexture | null, WebGLTexture | null] = [null, null];
   private accumIndex = 0;
   private fboBloomA: WebGLFramebuffer | null = null;
   private texBloomA: WebGLTexture | null = null;
   private fboBloomB: WebGLFramebuffer | null = null;
   private texBloomB: WebGLTexture | null = null;
   private bloomSize: [number, number] = [0, 0];
   private multipassSize: [number, number] = [0, 0];
   private lastFrameTime = 0;
   private multipassAvailable = false;

   /**
    * True if WebGL was successfully initialized and the emulator can render.
    * If false, callers should fallback to a standard 2D canvas context.
    */
   public useWebGL = false;

   private resizeObserver: ResizeObserver | null = null;
   private resizeListener: (() => void) | null = null;

   /**
    * Creates an instance of CRTEmulator.
    * @param canvas The target HTML canvas to render the CRT effect onto.
    */
   constructor(private canvas: HTMLCanvasElement) {}

   /**
    * Initializes WebGL, compiles vertex/fragment shaders, configures vertex buffers,
    * caches shader uniform locations, and creates textures.
    *
    * @returns `true` if WebGL initialization succeeded, `false` otherwise.
    */
   public init(): boolean {
      if (!this.canvas) return false;
      try {
         const gl = (this.canvas.getContext("webgl") || this.canvas.getContext("experimental-webgl")) as WebGLRenderingContext;
         if (!gl) {
            console.warn("WebGL not supported, falling back to 2D context");
            return false;
         }
         this.gl = gl;

         // Enable standard derivatives extension for fwidth in WebGL 1.0 fragment shaders.
         // Without it the shader falls back to a constant mask (no moire suppression).
         const hasDerivatives = !!gl.getExtension('OES_standard_derivatives');

         // Compile Vertex Shader (Maps quad coordinates and texture coordinates)
         const vsSource = `
            attribute vec2 aPosition;
            attribute vec2 aTexCoord;
            varying vec2 vTexCoord;
            void main() {
               gl_Position = vec4(aPosition, 0.0, 1.0);
               vTexCoord = aTexCoord;
            }
         `;

         const loadShader = (type: number, source: string): WebGLShader | null => {
            const shader = gl.createShader(type);
            if (!shader) return null;
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
               console.error("Shader compile error:", gl.getShaderInfoLog(shader));
               gl.deleteShader(shader);
               return null;
            }
            return shader;
         };

         const vs = loadShader(gl.VERTEX_SHADER, vsSource);
         // In WebGL 1 fwidth needs both the JS extension AND the #extension
         // directive; without the extension the mask falls back to constant.
         const fragmentPrefix = hasDerivatives
            ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES 1\n"
            : "";
         const fsCRT = loadShader(gl.FRAGMENT_SHADER, fragmentPrefix + fsCRTSource);

         if (!vs || !fsCRT) return false;

         const createProgram = (vsShader: WebGLShader, fsShader: WebGLShader): WebGLProgram | null => {
            const program = gl.createProgram();
            if (!program) return null;
            gl.attachShader(program, vsShader);
            gl.attachShader(program, fsShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
               console.error("Program link error:", gl.getProgramInfoLog(program));
               gl.deleteProgram(program);
               return null;
            }
            return program;
         };

         this.glProgramCRT = createProgram(vs, fsCRT);

         if (!this.glProgramCRT) return false;

         // Multipass programs (used only when persistence/bloom are active).
         // Created eagerly here so a compile problem surfaces at init, not mid-frame.
         const mkProg = (fsSource: string): WebGLProgram | null => {
            const fs = loadShader(gl.FRAGMENT_SHADER, fragmentPrefix + fsSource);
            if (!fs) return null;
            return createProgram(vs, fs);
         };
         this.progScene = mkProg(fsSceneSource);
         this.progPresent = mkProg(fsPresentSource);
         this.progAccum = mkProg(fsAccumSource);
         this.progBright = mkProg(fsBrightPassSource);
         this.progBlur = mkProg(fsBlurSource);
         this.multipassAvailable =
            !!this.progScene && !!this.progPresent && !!this.progAccum &&
            !!this.progBright && !!this.progBlur;

         // Cache uniform locations to avoid costly lookups during draw calls
         this.uniforms = {
            uSampler: gl.getUniformLocation(this.glProgramCRT, "uSampler"),
            uResolution: gl.getUniformLocation(this.glProgramCRT, "uResolution"),
            uTextureResolution: gl.getUniformLocation(this.glProgramCRT, "uTextureResolution"),
            uHardScan: gl.getUniformLocation(this.glProgramCRT, "uHardScan"),
            uHardPix: gl.getUniformLocation(this.glProgramCRT, "uHardPix"),
            uWarp: gl.getUniformLocation(this.glProgramCRT, "uWarp"),
            uMaskDark: gl.getUniformLocation(this.glProgramCRT, "uMaskDark"),
            uMaskLight: gl.getUniformLocation(this.glProgramCRT, "uMaskLight"),
            uMaskScale: gl.getUniformLocation(this.glProgramCRT, "uMaskScale"),
            uChromaBleed: gl.getUniformLocation(this.glProgramCRT, "uChromaBleed"),
            uChromaPhase: gl.getUniformLocation(this.glProgramCRT, "uChromaPhase"),
            uChromaCrosstalk: gl.getUniformLocation(this.glProgramCRT, "uChromaCrosstalk"),
            uMaskWidth: gl.getUniformLocation(this.glProgramCRT, "uMaskWidth"),
            uMaskHeight: gl.getUniformLocation(this.glProgramCRT, "uMaskHeight"),
            uGapWidth: gl.getUniformLocation(this.glProgramCRT, "uGapWidth"),
            uGapHeight: gl.getUniformLocation(this.glProgramCRT, "uGapHeight"),
            uMaskFade: gl.getUniformLocation(this.glProgramCRT, "uMaskFade"),
            uConvergence: gl.getUniformLocation(this.glProgramCRT, "uConvergence"),
            uCornerRadius: gl.getUniformLocation(this.glProgramCRT, "uCornerRadius"),
            uJitter: gl.getUniformLocation(this.glProgramCRT, "uJitter"),
            uTime: gl.getUniformLocation(this.glProgramCRT, "uTime"),
            uMaskType: gl.getUniformLocation(this.glProgramCRT, "uMaskType"),
            aPosition: gl.getAttribLocation(this.glProgramCRT, "aPosition"),
            aTexCoord: gl.getAttribLocation(this.glProgramCRT, "aTexCoord"),
         };

         // Cache uniform locations for the multipass programs
         const loc = (p: WebGLProgram | null, n: string) =>
            p ? gl.getUniformLocation(p, n) : null;
         this.uScene = {
            uSampler: loc(this.progScene, "uSampler"),
            uResolution: loc(this.progScene, "uResolution"),
            uTextureResolution: loc(this.progScene, "uTextureResolution"),
            uHardScan: loc(this.progScene, "uHardScan"),
            uHardPix: loc(this.progScene, "uHardPix"),
            uWarp: loc(this.progScene, "uWarp"),
            uChromaBleed: loc(this.progScene, "uChromaBleed"),
            uChromaPhase: loc(this.progScene, "uChromaPhase"),
            uChromaCrosstalk: loc(this.progScene, "uChromaCrosstalk"),
            uConvergence: loc(this.progScene, "uConvergence"),
            uJitter: loc(this.progScene, "uJitter"),
            uTime: loc(this.progScene, "uTime"),
         };
         this.uPresent = {
            uScene: loc(this.progPresent, "uScene"),
            uBloom: loc(this.progPresent, "uBloom"),
            uBloomAmount: loc(this.progPresent, "uBloomAmount"),
            uResolution: loc(this.progPresent, "uResolution"),
            uMaskDark: loc(this.progPresent, "uMaskDark"),
            uMaskLight: loc(this.progPresent, "uMaskLight"),
            uMaskScale: loc(this.progPresent, "uMaskScale"),
            uMaskWidth: loc(this.progPresent, "uMaskWidth"),
            uMaskHeight: loc(this.progPresent, "uMaskHeight"),
            uGapWidth: loc(this.progPresent, "uGapWidth"),
            uGapHeight: loc(this.progPresent, "uGapHeight"),
            uMaskFade: loc(this.progPresent, "uMaskFade"),
            uCornerRadius: loc(this.progPresent, "uCornerRadius"),
            uWarpUnused: loc(this.progPresent, "uWarp"),
         };
         this.uAccum = {
            uCur: loc(this.progAccum, "uCur"),
            uPrev: loc(this.progAccum, "uPrev"),
            uDecay: loc(this.progAccum, "uDecay"),
         };
         this.uBright = { uTex: loc(this.progBright, "uTex") };
         this.uBlur = { uTex: loc(this.progBlur, "uTex"), uTexel: loc(this.progBlur, "uTexel") };

         // Setup vertices quad (two triangles covering the full viewport)
         // Each vertex has: X, Y (position), U, V (texture coordinate)
         const vertices = new Float32Array([
            -1.0, -1.0,   0.0, 0.0,
             1.0, -1.0,   1.0, 0.0,
            -1.0,  1.0,   0.0, 1.0,
            -1.0,  1.0,   0.0, 1.0,
             1.0, -1.0,   1.0, 0.0,
             1.0,  1.0,   1.0, 1.0
         ]);

         this.glVertexBuffer = gl.createBuffer();
         gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);
         gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

         // Create texture that will hold the emulator's raw video buffer
         this.glTex = gl.createTexture();
         gl.bindTexture(gl.TEXTURE_2D, this.glTex);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

         this.useWebGL = true;
         return true;
      } catch (e) {
         console.error("Failed to initialize WebGL:", e);
         this.useWebGL = false;
         return false;
      }
   }

   /**
    * Renders a frame using the CRT simulation shader.
    * Sets up the viewport, uploads raw pixel data to WebGL texture, updates shader uniforms,
    * and draws the fullscreen quad.
    *
    * @param SCREEN_W Width of the active emulator screen in pixels.
    * @param SCREEN_H Height of the active emulator screen in pixels.
    * @param doubleScanlines Set to true if scanlines are doubled in height.
    * @param imageData Raw pixel buffer (ImageData) containing the current frame colors.
    * @param customOptions Custom CRT parameters to override default visual settings.
    */
   public render(
      SCREEN_W: number,
      SCREEN_H: number,
      doubleScanlines: boolean,
      imageData: ImageData,
      customOptions?: CRTEmulatorOptions
   ): void {
      if (!this.useWebGL || !this.gl || !this.glProgramCRT || !this.uniforms) return;

      const gl = this.gl;
      const opt = customOptions ? { ...DEFAULT_OPTIONS, ...customOptions } : DEFAULT_OPTIONS;
      const useMultipass = this.multipassAvailable &&
         ((opt.persistence ?? 0) > 0 || (opt.bloom ?? 0) > 0);

      const texW = SCREEN_W;
      const texH = doubleScanlines ? SCREEN_H * 2 : SCREEN_H;

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.glTex);
      // Flip the texture vertically during unpack as WebGL coordinates start bottom-left
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);

      if (useMultipass) {
         this.renderMultipass(SCREEN_W, SCREEN_H, doubleScanlines, imageData, opt);
         return;
      }

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(this.glProgramCRT);

      gl.uniform1i(this.uniforms.uSampler, 0);
      gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.uniforms.uTextureResolution, texW, texH);

      // Set CRT shader uniforms dynamically, merging with defaults
      gl.uniform1f(this.uniforms.uHardScan, opt.hardScan);
      gl.uniform1f(this.uniforms.uHardPix, opt.hardPix);
      gl.uniform2f(this.uniforms.uWarp, opt.warp, opt.warp);
      gl.uniform1f(this.uniforms.uMaskDark, opt.maskDark);
      gl.uniform1f(this.uniforms.uMaskLight, opt.maskLight);
      gl.uniform1f(this.uniforms.uMaskScale, opt.maskScale);
      gl.uniform1f(this.uniforms.uChromaBleed, opt.chromaBleed);
      gl.uniform1f(this.uniforms.uChromaPhase, opt.chromaPhase);
      gl.uniform1f(this.uniforms.uChromaCrosstalk, opt.chromaCrosstalk);
      gl.uniform1f(this.uniforms.uMaskWidth, opt.maskWidth);
      gl.uniform1f(this.uniforms.uMaskHeight, opt.maskHeight);
      gl.uniform1f(this.uniforms.uGapWidth, opt.gapWidth);
      gl.uniform1f(this.uniforms.uGapHeight, opt.gapHeight);
      gl.uniform1f(this.uniforms.uMaskFade, opt.maskFade);
      gl.uniform1f(this.uniforms.uConvergence, opt.convergence);
      gl.uniform1f(this.uniforms.uCornerRadius, opt.cornerRadius);
      gl.uniform1f(this.uniforms.uJitter, opt.jitter);
      gl.uniform1f(this.uniforms.uTime, performance.now() / 1000);
      const maskTypeIndex = opt.maskType === "grille" ? 1 : (opt.maskType === "delta" ? 2 : 0);
      gl.uniform1i(this.uniforms.uMaskType, maskTypeIndex);

      const aPositionLoc = this.uniforms.aPosition;
      const aTexCoordLoc = this.uniforms.aTexCoord;

      gl.enableVertexAttribArray(aPositionLoc);
      gl.enableVertexAttribArray(aTexCoordLoc);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);
      // We have 4 float components per vertex: 2 for position, 2 for texture coord.
      // Total stride is 4 * 4 bytes = 16 bytes.
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(aTexCoordLoc, 2, gl.FLOAT, false, 16, 8);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
   }

   /**
    * Multipass path: scene -> (persistence accumulate) -> bloom -> present.
    * Used only when persistence or bloom are non-zero.
    */
   private renderMultipass(
      SCREEN_W: number,
      SCREEN_H: number,
      doubleScanlines: boolean,
      _imageData: ImageData,
      opt: Required<CRTEmulatorOptions>
   ): void {
      const gl = this.gl!;
      const now = performance.now() / 1000;
      let dt = now - this.lastFrameTime;
      this.lastFrameTime = now;
      if (dt < 0 || dt > 0.25) dt = 1 / 60; // first frame or after a stall

      const cw = this.canvas.width, chh = this.canvas.height;

      // Recreate FBOs when the canvas is resized
      if (this.multipassSize[0] !== cw || this.multipassSize[1] !== chh) {
         this.ensureFBOs(cw, chh);
      }
      if (!this.fboScene || !this.fboAccum[0] || !this.fboAccum[1]) return;

      const aPos = this.uniforms!.aPosition, aUv = this.uniforms!.aTexCoord;
      const bindQuad = (prog: WebGLProgram) => {
         gl.useProgram(prog);
         gl.enableVertexAttribArray(aPos);
         gl.enableVertexAttribArray(aUv);
         gl.bindBuffer(gl.ARRAY_BUFFER, this.glVertexBuffer);
         gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
         gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);
      };

      // --- pass 1: scene -> FBO (linear light)
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboScene);
      gl.viewport(0, 0, cw, chh);
      bindQuad(this.progScene!);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.glTex);
      gl.uniform1i(this.uScene.uSampler!, 0);
      gl.uniform2f(this.uScene.uResolution!, cw, chh);
      gl.uniform2f(this.uScene.uTextureResolution!, SCREEN_W, doubleScanlines ? SCREEN_H * 2 : SCREEN_H);
      gl.uniform1f(this.uScene.uHardScan!, opt.hardScan);
      gl.uniform1f(this.uScene.uHardPix!, opt.hardPix);
      gl.uniform2f(this.uScene.uWarp!, opt.warp, opt.warp);
      gl.uniform1f(this.uScene.uChromaBleed!, opt.chromaBleed);
      gl.uniform1f(this.uScene.uChromaPhase!, opt.chromaPhase);
      gl.uniform1f(this.uScene.uChromaCrosstalk!, opt.chromaCrosstalk);
      gl.uniform1f(this.uScene.uConvergence!, opt.convergence);
      gl.uniform1f(this.uScene.uJitter!, opt.jitter);
      gl.uniform1f(this.uScene.uTime!, performance.now() / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // --- pass 2: persistence accumulation (ping-pong)
      let sceneTex = this.texScene;
      if ((opt.persistence ?? 0) > 0) {
         const writeIdx = this.accumIndex;
         const readIdx = 1 - writeIdx;
         const decay = Math.pow(opt.persistence!, dt * 60);
         gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboAccum[writeIdx]);
         gl.viewport(0, 0, cw, chh);
         bindQuad(this.progAccum!);
         gl.activeTexture(gl.TEXTURE0);
         gl.bindTexture(gl.TEXTURE_2D, sceneTex);
         gl.uniform1i(this.uAccum.uCur!, 0);
         gl.activeTexture(gl.TEXTURE1);
         gl.bindTexture(gl.TEXTURE_2D, this.texAccum[readIdx]);
         gl.uniform1i(this.uAccum.uPrev!, 1);
         gl.uniform1f(this.uAccum.uDecay!, decay);
         gl.drawArrays(gl.TRIANGLES, 0, 6);
         sceneTex = this.texAccum[writeIdx];
         this.accumIndex = readIdx;
      }

      // --- bloom chain: bright-pass + blur H + blur V at 1/4 resolution
      let bloomTex = this.texBloomA;
      if ((opt.bloom ?? 0) > 0 && this.fboBloomA && this.fboBloomB) {
         const [bw, bh] = this.bloomSize;

         gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBloomA);
         gl.viewport(0, 0, bw, bh);
         bindQuad(this.progBright!);
         gl.activeTexture(gl.TEXTURE0);
         gl.bindTexture(gl.TEXTURE_2D, sceneTex);
         gl.uniform1i(this.uBright.uTex!, 0);
         gl.drawArrays(gl.TRIANGLES, 0, 6);

         // blur horizontal (into B)
         gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBloomB);
         gl.viewport(0, 0, bw, bh);
         bindQuad(this.progBlur!);
         gl.activeTexture(gl.TEXTURE0);
         gl.bindTexture(gl.TEXTURE_2D, this.texBloomA);
         gl.uniform1i(this.uBlur.uTex!, 0);
         gl.uniform2f(this.uBlur.uTexel!, 1 / bw, 0);
         gl.drawArrays(gl.TRIANGLES, 0, 6);

         // blur vertical (into A)
         gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBloomA);
         gl.viewport(0, 0, bw, bh);
         bindQuad(this.progBlur!);
         gl.activeTexture(gl.TEXTURE0);
         gl.bindTexture(gl.TEXTURE_2D, this.texBloomB);
         gl.uniform1i(this.uBlur.uTex!, 0);
         gl.uniform2f(this.uBlur.uTexel!, 0, 1 / bh);
         gl.drawArrays(gl.TRIANGLES, 0, 6);
         bloomTex = this.texBloomA;
      }

      // --- final pass: present to the canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, chh);
      bindQuad(this.progPresent!);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.uniform1i(this.uPresent.uScene!, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bloomTex);
      gl.uniform1i(this.uPresent.uBloom!, 1);
      gl.uniform1f(this.uPresent.uBloomAmount!, opt.bloom ?? 0);
      gl.uniform2f(this.uPresent.uResolution!, cw, chh);
      gl.uniform1f(this.uPresent.uMaskDark!, opt.maskDark);
      gl.uniform1f(this.uPresent.uMaskLight!, opt.maskLight);
      gl.uniform1f(this.uPresent.uMaskScale!, opt.maskScale);
      gl.uniform1f(this.uPresent.uMaskWidth!, opt.maskWidth);
      gl.uniform1f(this.uPresent.uMaskHeight!, opt.maskHeight);
      gl.uniform1f(this.uPresent.uGapWidth!, opt.gapWidth);
      gl.uniform1f(this.uPresent.uGapHeight!, opt.gapHeight);
      gl.uniform1f(this.uPresent.uMaskFade!, opt.maskFade);
      gl.uniform1f(this.uPresent.uCornerRadius!, opt.cornerRadius);
      const maskTypeIndex2 = opt.maskType === "grille" ? 1 : (opt.maskType === "delta" ? 2 : 0);
      gl.uniform1i(this.uPresent.uMaskType!, maskTypeIndex2);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
   }

   /**
    * (Re)creates the offscreen framebuffers used by the multipass path.
    */
   private ensureFBOs(w: number, h: number): void {
      const gl = this.gl!;
      this.destroyFBOs();

      // Linear filtering + clamp for all intermediate textures
      const setupTex = (tex: WebGLTexture, tw: number, th: number) => {
         gl.bindTexture(gl.TEXTURE_2D, tex);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
         gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      };

      this.texScene = gl.createTexture();
      setupTex(this.texScene, w, h);
      this.fboScene = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboScene);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texScene, 0);

      for (let i = 0; i < 2; i++) {
         this.texAccum[i] = gl.createTexture();
         setupTex(this.texAccum[i]!, w, h);
         this.fboAccum[i] = gl.createFramebuffer();
         gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboAccum[i]);
         gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texAccum[i], 0);
      }

      const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
      this.bloomSize = [bw, bh];
      this.texBloomA = gl.createTexture();
      setupTex(this.texBloomA, bw, bh);
      this.fboBloomA = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBloomA);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texBloomA, 0);

      this.texBloomB = gl.createTexture();
      setupTex(this.texBloomB, bw, bh);
      this.fboBloomB = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboBloomB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texBloomB, 0);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      this.multipassSize = [w, h];
   }

   /**
    * Deletes all multipass framebuffer resources.
    */
   private destroyFBOs(): void {
      const gl = this.gl;
      if (!gl) return;
      if (this.texScene) gl.deleteTexture(this.texScene);
      if (this.fboScene) gl.deleteFramebuffer(this.fboScene);
      for (let i = 0; i < 2; i++) {
         if (this.texAccum[i]) gl.deleteTexture(this.texAccum[i]);
         if (this.fboAccum[i]) gl.deleteFramebuffer(this.fboAccum[i]);
      }
      if (this.texBloomA) gl.deleteTexture(this.texBloomA);
      if (this.fboBloomA) gl.deleteFramebuffer(this.fboBloomA);
      if (this.texBloomB) gl.deleteTexture(this.texBloomB);
      if (this.fboBloomB) gl.deleteFramebuffer(this.fboBloomB);
      this.texScene = null;
      this.fboScene = null;
      this.texAccum = [null, null];
      this.fboAccum = [null, null];
      this.texBloomA = null;
      this.fboBloomA = null;
      this.texBloomB = null;
      this.fboBloomB = null;
      this.multipassSize = [0, 0];
   }

   /**
    * Triggers a manual canvas resize based on its client bounding rect and device pixel ratio.
    * Uses provided parameters as fallbacks if the canvas is not yet attached to the DOM.
    *
    * @param fallbackWidth Optional fallback width in pixels if the canvas rect width is 0.
    * @param fallbackHeight Optional fallback height in pixels if the canvas rect height is 0.
    */
   public resize(fallbackWidth?: number, fallbackHeight?: number): void {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * dpr) || fallbackWidth || this.canvas.width;
      const height = Math.round(rect.height * dpr) || fallbackHeight || this.canvas.height;

      if (this.canvas.width !== width || this.canvas.height !== height) {
         this.canvas.width = width;
         this.canvas.height = height;
      }
   }

   /**
    * Configures an automatic resize observer for the canvas. It will also perform
    * the initial resize synchronously during this call.
    *
    * @param getFallbackDimensions Optional callback returning fallback width and height.
    */
   public setupResizeObserver(getFallbackDimensions?: () => { width: number; height: number }): void {
      if (typeof window === 'undefined') return;

      const runResize = () => {
         const fallback = getFallbackDimensions ? getFallbackDimensions() : undefined;
         this.resize(fallback?.width, fallback?.height);
      };

      if (typeof ResizeObserver !== 'undefined') {
         if (!this.resizeObserver) {
            this.resizeObserver = new ResizeObserver(runResize);
            this.resizeObserver.observe(this.canvas);
         }
      } else if (!this.resizeListener) {
         this.resizeListener = runResize;
         window.addEventListener('resize', this.resizeListener);
      }

      // Perform the initial resize synchronously
      runResize();
   }

   /**
    * Cleans up observers, listeners and WebGL resources to prevent memory leaks.
    */
   public destroy(): void {
      if (this.resizeObserver) {
         this.resizeObserver.disconnect();
         this.resizeObserver = null;
      }
      if (this.resizeListener) {
         window.removeEventListener('resize', this.resizeListener);
         this.resizeListener = null;
      }

      const gl = this.gl;
      if (gl && this.useWebGL) {
         this.destroyFBOs();
         if (this.glTex) gl.deleteTexture(this.glTex);
         if (this.glVertexBuffer) gl.deleteBuffer(this.glVertexBuffer);
         if (this.glProgramCRT) gl.deleteProgram(this.glProgramCRT);
         for (const p of [this.progScene, this.progPresent, this.progAccum, this.progBright, this.progBlur]) {
            if (p) gl.deleteProgram(p);
         }
         this.progScene = null;
         this.progPresent = null;
         this.progAccum = null;
         this.progBright = null;
         this.progBlur = null;
         this.glTex = null;
         this.glVertexBuffer = null;
         this.glProgramCRT = null;
         this.uniforms = null;
         this.useWebGL = false;

         const loseContext = gl.getExtension("WEBGL_lose_context");
         if (loseContext) loseContext.loseContext();
      }
   }
}
