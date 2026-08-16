import { CRTEmulatorOptions, DEFAULT_OPTIONS } from "./crt_emulation.js";

/**
 * Metadata definition for CRT emulator parameter controls.
 */
interface ParamConfig {
   key: keyof CRTEmulatorOptions;
   label: string;
   min: number;
   max: number;
   step: number;
   defaultValue: number;
   description: string;
}

const PARAM_CONFIGS: ParamConfig[] = [
   {
      key: "hardScan",
      label: "hardScan",
      min: -30.0,
      max: 0.0,
      step: 0.1,
      defaultValue: DEFAULT_OPTIONS.hardScan,
      description: "Scanline sharpness/softness (-8.0 soft, -16.0 medium, -20.0 sharp)",
   },
   {
      key: "hardPix",
      label: "hardPix",
      min: -10.0,
      max: 0.0,
      step: 0.1,
      defaultValue: DEFAULT_OPTIONS.hardPix,
      description: "Horizontal pixel sharpness (-2.0 soft, -4.0 hard)",
   },
   {
      key: "warp",
      label: "warp",
      min: 0.0,
      max: 0.2,
      step: 0.005,
      defaultValue: DEFAULT_OPTIONS.warp,
      description: "CRT curvature factor (0.0 flat screen)",
   },
   {
      key: "maskDark",
      label: "maskDark",
      min: 0.0,
      max: 2.0,
      step: 0.05,
      defaultValue: DEFAULT_OPTIONS.maskDark,
      description: "Shadow mask dark pixel scale",
   },
   {
      key: "maskLight",
      label: "maskLight",
      min: 0.0,
      max: 2.0,
      step: 0.05,
      defaultValue: DEFAULT_OPTIONS.maskLight,
      description: "Shadow mask light pixel scale",
   },
   {
      key: "maskScale",
      label: "maskScale",
      min: 0.1,
      max: 5.0,
      step: 0.05,
      defaultValue: DEFAULT_OPTIONS.maskScale,
      description: "Phosphor mask triad scale factor",
   },
   {
      key: "chromaBleed",
      label: "chromaBleed",
      min: 0.0,
      max: 5.0,
      step: 0.1,
      defaultValue: DEFAULT_OPTIONS.chromaBleed,
      description: "Chroma bleed radius in texels (0.0 RGB, 2.0 C64 composite)",
   },
   {
      key: "chromaPhase",
      label: "chromaPhase",
      min: 0.0,
      max: 1.0,
      step: 0.01,
      defaultValue: DEFAULT_OPTIONS.chromaPhase,
      description: "Subcarrier phase advance (0.5 NTSC, 0.625 PAL)",
   },
   {
      key: "chromaCrosstalk",
      label: "chromaCrosstalk",
      min: 0.0,
      max: 1.0,
      step: 0.01,
      defaultValue: DEFAULT_OPTIONS.chromaCrosstalk,
      description: "Luma-to-chroma crosstalk fringing",
   },
   {
      key: "maskWidth",
      label: "maskWidth",
      min: 1.0,
      max: 12.0,
      step: 0.1,
      defaultValue: DEFAULT_OPTIONS.maskWidth,
      description: "RGB triad width in pixels",
   },
   {
      key: "maskHeight",
      label: "maskHeight",
      min: 1.0,
      max: 20.0,
      step: 0.1,
      defaultValue: DEFAULT_OPTIONS.maskHeight,
      description: "RGB triad height in pixels",
   },
   {
      key: "gapWidth",
      label: "gapWidth",
      min: 0.0,
      max: 2.0,
      step: 0.05,
      defaultValue: DEFAULT_OPTIONS.gapWidth,
      description: "Vertical phosphor gap width",
   },
   {
      key: "gapHeight",
      label: "gapHeight",
      min: 0.0,
      max: 2.0,
      step: 0.05,
      defaultValue: DEFAULT_OPTIONS.gapHeight,
      description: "Horizontal phosphor gap height",
   },
   {
      key: "maskFade",
      label: "maskFade",
      min: 0.0,
      max: 1.0,
      step: 0.01,
      defaultValue: DEFAULT_OPTIONS.maskFade,
      description: "Dynamic mask fading factor on bright pixels",
   },
];

/**
 * Options for opening the CRT Emulator control panel window.
 */
export interface CRTControlPanelOptions {
   /** Initial parameter values */
   options?: Partial<CRTEmulatorOptions>;
   /** Callback invoked in real-time when any slider value changes */
   onChange?: (options: CRTEmulatorOptions) => void;
   /** Callback invoked when the window is closed */
   onClose?: (options: CRTEmulatorOptions) => void;
}

/**
 * Handle returned by `crt_emulator()` to manage the control panel programmatically.
 */
export interface CRTControlPanelHandle {
   /** Close the control panel window */
   close: () => void;
   /** Get current parameter values */
   getOptions: () => CRTEmulatorOptions;
   /** Update one or more parameter values */
   setOptions: (newOptions: Partial<CRTEmulatorOptions>) => void;
   /** The root HTML element of the window */
   element: HTMLElement;
}

let activePanelHandle: CRTControlPanelHandle | null = null;

const STYLE_ELEMENT_ID = "crt-emulator-gui-styles";

function injectStyles(): void {
   if (typeof document === "undefined" || document.getElementById(STYLE_ELEMENT_ID)) {
      return;
   }

   const style = document.createElement("style");
   style.id = STYLE_ELEMENT_ID;
   style.textContent = `
      .crt-gui-window {
         position: fixed;
         top: 20px;
         right: 20px;
         width: 320px;
         max-width: calc(100vw - 30px);
         max-height: calc(100vh - 40px);
         background: #18181f;
         color: #e0e0e8;
         border: 1px solid #3e3e50;
         border-radius: 8px;
         box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08);
         font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
         font-size: 11px;
         z-index: 999999;
         display: flex;
         flex-direction: column;
         overflow: hidden;
         user-select: none;
         box-sizing: border-box;
      }
      .crt-gui-window * {
         box-sizing: border-box;
      }
      .crt-gui-titlebar {
         display: flex;
         align-items: center;
         justify-content: space-between;
         background: #252532;
         padding: 7px 10px;
         border-bottom: 1px solid #3e3e50;
         cursor: grab;
         user-select: none;
         touch-action: none;
      }
      .crt-gui-titlebar:active {
         cursor: grabbing;
      }
      .crt-gui-title {
         font-weight: bold;
         font-size: 12px;
         color: #79d4fd;
         display: flex;
         align-items: center;
         gap: 6px;
      }
      .crt-gui-close-btn {
         background: transparent;
         border: none;
         color: #888899;
         font-size: 16px;
         font-weight: bold;
         line-height: 1;
         padding: 2px 6px;
         cursor: pointer;
         border-radius: 4px;
         transition: background 0.15s, color 0.15s;
      }
      .crt-gui-close-btn:hover {
         background: #e04444;
         color: #ffffff;
      }
      .crt-gui-content {
         padding: 10px;
         overflow-y: auto;
         flex: 1;
         display: flex;
         flex-direction: column;
         gap: 6px;
      }
      .crt-gui-row {
         display: flex;
         flex-direction: column;
         gap: 2px;
      }
      .crt-gui-row-header {
         display: flex;
         justify-content: space-between;
         align-items: center;
      }
      .crt-gui-label {
         color: #5af78e;
         font-weight: 600;
      }
      .crt-gui-value {
         color: #f3f99d;
         font-variant-numeric: tabular-nums;
      }
      .crt-gui-slider {
         width: 100%;
         height: 4px;
         -webkit-appearance: none;
         appearance: none;
         background: #323242;
         border-radius: 2px;
         outline: none;
         cursor: pointer;
         margin: 2px 0;
      }
      .crt-gui-slider::-webkit-slider-thumb {
         -webkit-appearance: none;
         appearance: none;
         width: 12px;
         height: 12px;
         border-radius: 50%;
         background: #caa6f7;
         border: 1px solid #ffffff;
         cursor: pointer;
         transition: transform 0.1s, background 0.1s;
      }
      .crt-gui-slider::-webkit-slider-thumb:hover {
         background: #ff79c6;
         transform: scale(1.25);
      }
      .crt-gui-slider::-moz-range-thumb {
         width: 12px;
         height: 12px;
         border-radius: 50%;
         background: #caa6f7;
         border: 1px solid #ffffff;
         cursor: pointer;
      }
      .crt-gui-footer {
         display: flex;
         gap: 8px;
         padding: 6px 10px;
         background: #20202b;
         border-top: 1px solid #323242;
         justify-content: space-between;
         align-items: center;
      }
      .crt-gui-hint {
         color: #777788;
         font-size: 10px;
      }
      .crt-gui-btn {
         background: #323244;
         color: #bbbbcc;
         border: 1px solid #4a4a60;
         border-radius: 4px;
         padding: 3px 8px;
         font-size: 11px;
         font-family: inherit;
         cursor: pointer;
         transition: background 0.15s, color 0.15s;
      }
      .crt-gui-btn:hover {
         background: #44445c;
         color: #fff;
      }
   `;
   document.head.appendChild(style);
}

function formatValue(value: number, step: number): string {
   if (step >= 1) return value.toFixed(0);
   if (step >= 0.1) return value.toFixed(1);
   if (step >= 0.01) return value.toFixed(2);
   return value.toFixed(3);
}

/**
 * Creates and displays a draggable floating window with sliders for all CRT emulator parameters.
 * Stays on top and when closed, the current parameters are logged to the console.
 *
 * @param optionsOrOnChange Optional initial options, options object, or onChange callback.
 * @param onChangeCallback Optional callback invoked when any parameter slider changes.
 * @returns Handle to interact with the control panel.
 */
export function crt_emulator(
   optionsOrOnChange?: Partial<CRTEmulatorOptions> | ((opts: CRTEmulatorOptions) => void) | CRTControlPanelOptions,
   onChangeCallback?: (opts: CRTEmulatorOptions) => void
): CRTControlPanelHandle {
   if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("crt_emulator can only be run in a browser environment.");
   }

   // Close any previously opened control panel
   if (activePanelHandle) {
      activePanelHandle.close();
   }

   injectStyles();

   let initialOptions: Partial<CRTEmulatorOptions> = {};
   let onChange: ((opts: CRTEmulatorOptions) => void) | undefined = onChangeCallback;
   let onClose: ((opts: CRTEmulatorOptions) => void) | undefined;

   if (typeof optionsOrOnChange === "function") {
      onChange = optionsOrOnChange;
   } else if (optionsOrOnChange && typeof optionsOrOnChange === "object") {
      if ("options" in optionsOrOnChange || "onChange" in optionsOrOnChange || "onClose" in optionsOrOnChange) {
         const config = optionsOrOnChange as CRTControlPanelOptions;
         initialOptions = config.options || {};
         if (config.onChange) onChange = config.onChange;
         if (config.onClose) onClose = config.onClose;
      } else {
         initialOptions = optionsOrOnChange as Partial<CRTEmulatorOptions>;
      }
   }

   const currentOptions: CRTEmulatorOptions = {
      ...DEFAULT_OPTIONS,
      ...initialOptions,
   };

   // Build window elements
   const win = document.createElement("div");
   win.className = "crt-gui-window";

   const titleBar = document.createElement("div");
   titleBar.className = "crt-gui-titlebar";

   const title = document.createElement("div");
   title.className = "crt-gui-title";
   title.innerHTML = `<span>📺</span> CRT Emulator Parameters`;

   const closeBtn = document.createElement("button");
   closeBtn.className = "crt-gui-close-btn";
   closeBtn.title = "Close (logs parameters to console)";
   closeBtn.innerHTML = "&times;";

   titleBar.appendChild(title);
   titleBar.appendChild(closeBtn);
   win.appendChild(titleBar);

   const content = document.createElement("div");
   content.className = "crt-gui-content";

   const sliderElements = new Map<keyof CRTEmulatorOptions, { input: HTMLInputElement; valSpan: HTMLElement }>();

   const notifyChange = () => {
      const optsCopy = { ...currentOptions };
      if (onChange) {
         onChange(optsCopy);
      }
      if (typeof window !== "undefined") {
         window.dispatchEvent(new CustomEvent("crt-emulator:change", { detail: optsCopy }));
      }
   };

   for (const param of PARAM_CONFIGS) {
      const row = document.createElement("div");
      row.className = "crt-gui-row";
      row.title = param.description;

      const header = document.createElement("div");
      header.className = "crt-gui-row-header";

      const label = document.createElement("span");
      label.className = "crt-gui-label";
      label.textContent = param.label;

      const valSpan = document.createElement("span");
      valSpan.className = "crt-gui-value";
      const initialVal = currentOptions[param.key] ?? param.defaultValue;
      valSpan.textContent = formatValue(initialVal, param.step);

      header.appendChild(label);
      header.appendChild(valSpan);

      const input = document.createElement("input");
      input.type = "range";
      input.className = "crt-gui-slider";
      input.min = param.min.toString();
      input.max = param.max.toString();
      input.step = param.step.toString();
      input.value = initialVal.toString();

      input.addEventListener("input", () => {
         const val = parseFloat(input.value);
         currentOptions[param.key] = val;
         valSpan.textContent = formatValue(val, param.step);
         notifyChange();
      });

      row.appendChild(header);
      row.appendChild(input);
      content.appendChild(row);

      sliderElements.set(param.key, { input, valSpan });
   }

   win.appendChild(content);

   // Footer with Reset Defaults button
   const footer = document.createElement("div");
   footer.className = "crt-gui-footer";

   const hint = document.createElement("span");
   hint.className = "crt-gui-hint";
   hint.textContent = "Drag title bar to move";

   const resetBtn = document.createElement("button");
   resetBtn.className = "crt-gui-btn";
   resetBtn.textContent = "Reset Defaults";
   resetBtn.addEventListener("click", () => {
      for (const param of PARAM_CONFIGS) {
         currentOptions[param.key] = param.defaultValue;
         const entry = sliderElements.get(param.key);
         if (entry) {
            entry.input.value = param.defaultValue.toString();
            entry.valSpan.textContent = formatValue(param.defaultValue, param.step);
         }
      }
      notifyChange();
   });

   footer.appendChild(hint);
   footer.appendChild(resetBtn);
   win.appendChild(footer);

   document.body.appendChild(win);

   // Dragging implementation
   let isDragging = false;
   let dragOffsetX = 0;
   let dragOffsetY = 0;

   const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (e.target === closeBtn || (e.target as HTMLElement).closest(".crt-gui-close-btn")) {
         return;
      }
      isDragging = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = win.getBoundingClientRect();
      dragOffsetX = clientX - rect.left;
      dragOffsetY = clientY - rect.top;
      e.preventDefault();
   };

   const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      let newLeft = clientX - dragOffsetX;
      let newTop = clientY - dragOffsetY;

      // Bound within viewport
      const maxLeft = Math.max(0, window.innerWidth - win.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - win.offsetHeight);
      newLeft = Math.max(0, Math.min(newLeft, maxLeft));
      newTop = Math.max(0, Math.min(newTop, maxTop));

      win.style.left = `${newLeft}px`;
      win.style.top = `${newTop}px`;
      win.style.right = "auto";
      win.style.bottom = "auto";
   };

   const onPointerUp = () => {
      isDragging = false;
   };

   titleBar.addEventListener("mousedown", onPointerDown);
   titleBar.addEventListener("touchstart", onPointerDown, { passive: false });
   window.addEventListener("mousemove", onPointerMove);
   window.addEventListener("touchmove", onPointerMove, { passive: false });
   window.addEventListener("mouseup", onPointerUp);
   window.addEventListener("touchend", onPointerUp);

   // Close action
   let isClosed = false;
   const close = () => {
      if (isClosed) return;
      isClosed = true;

      // Cleanup drag events
      titleBar.removeEventListener("mousedown", onPointerDown);
      titleBar.removeEventListener("touchstart", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);

      if (win.parentNode) {
         win.parentNode.removeChild(win);
      }

      if (activePanelHandle === handle) {
         activePanelHandle = null;
      }

      // Display parameters on console
      const finalOptions: CRTEmulatorOptions = { ...currentOptions };
      console.log("CRT Emulator Parameters:", finalOptions);
      console.log(JSON.stringify(finalOptions, null, 2));

      if (onClose) {
         onClose(finalOptions);
      }

      if (typeof window !== "undefined") {
         window.dispatchEvent(new CustomEvent("crt-emulator:close", { detail: finalOptions }));
      }
   };

   closeBtn.addEventListener("click", close);

   const handle: CRTControlPanelHandle = {
      close,
      getOptions: () => ({ ...currentOptions }),
      setOptions: (newOptions: Partial<CRTEmulatorOptions>) => {
         Object.assign(currentOptions, newOptions);
         for (const [key, val] of Object.entries(newOptions) as [keyof CRTEmulatorOptions, number][]) {
            const entry = sliderElements.get(key);
            const param = PARAM_CONFIGS.find((p) => p.key === key);
            if (entry && param && val !== undefined) {
               entry.input.value = val.toString();
               entry.valSpan.textContent = formatValue(val, param.step);
            }
         }
         notifyChange();
      },
      element: win,
   };

   activePanelHandle = handle;

   // Fire initial change notification
   notifyChange();

   return handle;
}

// Publish to window.crt_emulator if in browser environment
if (typeof window !== "undefined") {
   (window as any).crt_emulator = crt_emulator;
}

declare global {
   interface Window {
      crt_emulator: typeof crt_emulator;
   }
}
