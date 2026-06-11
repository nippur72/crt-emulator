/**
 * Original shader taken from https://www.shadertoy.com/view/XsjSzR
 * Improved with a better RGB mask and PAL colour bleed simulation.
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
    * Chroma (color) bleed simulation level.
    * Simulates signal bleeding common in composite PAL video connections.
    * - 0.0 = None (perfect RGB signal)
    * - 1.0 = Normal PAL bleed
    * - 2.0 = Strong PAL bleed
    * @default 1.0
    */
   chromaBleed?: number;

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
}

/**
 * Default options applied when rendering if no custom options are provided,
 * or used to fill in missing properties in user-supplied options.
 */
const DEFAULT_OPTIONS: Required<CRTEmulatorOptions> = {
   hardScan: -6.0,
   hardPix: -2.0,
   warp: 0.04,
   maskDark: 0.5,
   maskLight: 1.0,
   maskScale: 1.25,
   chromaBleed: 1.0,
   maskWidth: 3.0,
   maskHeight: 6.0,
   gapWidth: 0.25,
   gapHeight: 0.5,
};

/**
 * Internal interface to store compiled WebGL uniform locations.
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
   uMaskWidth: WebGLUniformLocation | null;
   uMaskHeight: WebGLUniformLocation | null;
   uGapWidth: WebGLUniformLocation | null;
   uGapHeight: WebGLUniformLocation | null;
}

/**
 * Returns the GLSL source code for the fragment shader.
 * The shader performs CRT warping, scanline synthesis, RGB shadow mask application,
 * and PAL composite signal chroma bleed emulation.
 *
 * @returns The GLSL ES 1.0 fragment shader source string.
 */
export function fsCRTSource(): string {
   return `
      #extension GL_OES_standard_derivatives : enable
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
      uniform float uMaskWidth;
      uniform float uMaskHeight;
      uniform float uGapWidth;
      uniform float uGapHeight;

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
         
         vec3 rgbCenter = ToLinear(texture2D(uSampler, texCoord).rgb);
         if (uChromaBleed <= 0.0) return rgbCenter;
         
         vec2 texCoordLeft = (floor(pos * uTextureResolution + off + vec2(-uChromaBleed, 0.0)) + vec2(0.5)) / uTextureResolution;
         vec2 texCoordRight = (floor(pos * uTextureResolution + off + vec2(uChromaBleed, 0.0)) + vec2(0.5)) / uTextureResolution;
         
         vec3 rgbLeft = ToLinear(texture2D(uSampler, texCoordLeft).rgb);
         vec3 rgbRight = ToLinear(texture2D(uSampler, texCoordRight).rgb);
         
         vec3 yuvCenter = RGBtoYUV(rgbCenter);
         vec3 yuvLeft = RGBtoYUV(rgbLeft);
         vec3 yuvRight = RGBtoYUV(rgbRight);
         
         float avgU = (yuvLeft.y + yuvCenter.y + yuvRight.y) / 3.0;
         float avgV = (yuvLeft.z + yuvCenter.z + yuvRight.z) / 3.0;
         
         return YUVtoRGB(vec3(yuvCenter.x, avgU, avgV));
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

      // Shadow mask.
      vec3 Mask(vec2 pos) {
         pos = pos / uMaskScale;
         
         // Derivative-based moire detection
         vec2 d = fwidth(pos);
         float maxD = max(d.x / uMaskWidth, d.y / uMaskHeight);
         float blend = smoothstep(0.3, 0.8, maxD);
         
         // Calculate average mask color
         float activeArea = (uMaskWidth - uGapWidth) * (uMaskHeight - uGapHeight) / (uMaskWidth * uMaskHeight);
         vec3 maskAvg = activeArea * vec3((uMaskLight + 2.0 * uMaskDark) / 3.0) + (1.0 - activeArea) * vec3(uMaskDark);
         
         float col = floor(pos.x / uMaskWidth);
         float y = pos.y + mod(col, 2.0) * (uMaskHeight / 2.0);
         
         // Horizontal dark row gap (modulus check)
         float yMod = mod(y, uMaskHeight);
         if (yMod >= (uMaskHeight - uGapHeight)) {
            return mix(vec3(uMaskDark, uMaskDark, uMaskDark), maskAvg, blend);
         }
         
         // Vertical dark column gap (modulus check)
         float xMod = mod(pos.x, uMaskWidth);
         if (xMod >= (uMaskWidth - uGapWidth)) {
            return mix(vec3(uMaskDark, uMaskDark, uMaskDark), maskAvg, blend);
         }
         
         // Active triad subpixel calculation
         float activeWidth = uMaskWidth - uGapWidth;
         float subpixelWidth = activeWidth / 3.0;
         
         vec3 mask = vec3(uMaskDark, uMaskDark, uMaskDark);
         if (xMod < subpixelWidth) {
            mask.r = uMaskLight;
         } else if (xMod < 2.0 * subpixelWidth) {
            mask.g = uMaskLight;
         } else {
            mask.b = uMaskLight;
         }
         return mix(mask, maskAvg, blend);
      }    

      void main(void) {
         vec2 pos = Warp(vTexCoord);
         vec3 color = Tri(pos) * Mask(pos * uResolution);
         gl_FragColor = vec4(ToSrgb(color), 1.0);
      }
   `;
}

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

         // Enable standard derivatives extension for fwidth in WebGL 1.0 fragment shaders
         gl.getExtension('OES_standard_derivatives');

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
         const fsCRT = loadShader(gl.FRAGMENT_SHADER, fsCRTSource());

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
            uMaskWidth: gl.getUniformLocation(this.glProgramCRT, "uMaskWidth"),
            uMaskHeight: gl.getUniformLocation(this.glProgramCRT, "uMaskHeight"),
            uGapWidth: gl.getUniformLocation(this.glProgramCRT, "uGapWidth"),
            uGapHeight: gl.getUniformLocation(this.glProgramCRT, "uGapHeight"),
         };

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

      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.glTex);
      // Flip the texture vertically during unpack as WebGL coordinates start bottom-left
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SCREEN_W, SCREEN_H * (doubleScanlines ? 2 : 1), 0, gl.RGBA, gl.UNSIGNED_BYTE, imageData.data);

      gl.useProgram(this.glProgramCRT);

      gl.uniform1i(this.uniforms.uSampler, 0);
      gl.uniform2f(this.uniforms.uResolution, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.uniforms.uTextureResolution, SCREEN_W, SCREEN_H);

      // Set CRT shader uniforms dynamically, merging with defaults
      const opt = customOptions ? { ...DEFAULT_OPTIONS, ...customOptions } : DEFAULT_OPTIONS;
      gl.uniform1f(this.uniforms.uHardScan, opt.hardScan);
      gl.uniform1f(this.uniforms.uHardPix, opt.hardPix);
      gl.uniform2f(this.uniforms.uWarp, opt.warp, opt.warp);
      gl.uniform1f(this.uniforms.uMaskDark, opt.maskDark);
      gl.uniform1f(this.uniforms.uMaskLight, opt.maskLight);
      gl.uniform1f(this.uniforms.uMaskScale, opt.maskScale);
      gl.uniform1f(this.uniforms.uChromaBleed, opt.chromaBleed);
      gl.uniform1f(this.uniforms.uMaskWidth, opt.maskWidth);
      gl.uniform1f(this.uniforms.uMaskHeight, opt.maskHeight);
      gl.uniform1f(this.uniforms.uGapWidth, opt.gapWidth);
      gl.uniform1f(this.uniforms.uGapHeight, opt.gapHeight);

      const aPositionLoc = gl.getAttribLocation(this.glProgramCRT, "aPosition");
      const aTexCoordLoc = gl.getAttribLocation(this.glProgramCRT, "aTexCoord");

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
    * Cleans up observers and listeners to prevent memory leaks.
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
   }
}
