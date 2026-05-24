/**
 * @module wasm-bridge
 * @description WASM renderer bridge — detects WASM availability, initializes
 * the Skia renderer, and falls back to SVG when WASM is unavailable.
 * Mirrors app.render_wasm.wasm and app.render_wasm.api from ClojureScript.
 */

let wasmModule = null;
let wasmInitialized = false;
let wasmAvailable = false;
let canvas = null;
let glContext = null;
let renderFrameId = null;
let viewport = { x: 0, y: 0, zoom: 1 };

const WASM_URL_PATH = '/js/render-wasm.wasm';
const WASM_JS_URL = '/js/render-wasm.js';

export function isWasmAvailable() {
  return wasmAvailable;
}

export function isWasmInitialized() {
  return wasmInitialized;
}

export async function detectWasm() {
  if (wasmAvailable) return true;

  try {
    const response = await fetch(WASM_URL_PATH, { method: 'HEAD' });
    if (!response.ok) {
      wasmAvailable = false;
      return false;
    }

    const jsResponse = await fetch(WASM_JS_URL, { method: 'HEAD' });
    wasmAvailable = jsResponse.ok;
  } catch {
    wasmAvailable = false;
  }

  return wasmAvailable;
}

export async function initWasmRenderer(canvasElement, options = {}) {
  if (wasmInitialized) return true;

  canvas = canvasElement;

  try {
    await detectWasm();

    if (!wasmAvailable) {
      console.info('[wasm-bridge] WASM not available, using SVG fallback');
      return false;
    }

    const module = await import(WASM_JS_URL);
    const initFn = module.default || module.initWasm;

    if (typeof initFn === 'function') {
      wasmModule = await initFn({
        canvas: canvasElement,
        locateFile: (path) => {
          if (path.endsWith('.wasm')) return WASM_URL_PATH;
          return path;
        },
      });
    }

    if (wasmModule && wasmModule._init) {
      const dpr = options.devicePixelRatio || window.devicePixelRatio || 1;
      const width = canvasElement.clientWidth;
      const height = canvasElement.clientHeight;

      wasmModule._init(width, height);
      wasmModule._set_render_options(0, dpr);

      wasmInitialized = true;

      if (options.viewport) {
        setWasmViewport(options.viewport);
      }

      canvasElement.addEventListener('webglcontextlost', handleContextLost);
      canvasElement.addEventListener('webglcontextrestored', handleContextRestored);

      console.info('[wasm-bridge] WASM renderer initialized');
      return true;
    }

    wasmAvailable = false;
    return false;
  } catch (err) {
    console.warn('[wasm-bridge] WASM init failed, falling back to SVG:', err);
    wasmAvailable = false;
    wasmInitialized = false;
    return false;
  }
}

function handleContextLost(e) {
  e.preventDefault();
  wasmInitialized = false;
  console.warn('[wasm-bridge] WebGL context lost');
  document.dispatchEvent(new CustomEvent('penpot:wasm:context-lost'));
}

function handleContextRestored(e) {
  e.preventDefault();
  console.info('[wasm-bridge] WebGL context restored');
  if (canvas && wasmModule) {
    initWasmRenderer(canvas, { viewport }).then(() => {
      document.dispatchEvent(new CustomEvent('penpot:wasm:context-restored'));
    });
  }
}

export function destroyWasmRenderer() {
  if (renderFrameId) {
    cancelAnimationFrame(renderFrameId);
    renderFrameId = null;
  }

  if (canvas) {
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
  }

  wasmModule = null;
  wasmInitialized = false;
  canvas = null;
  glContext = null;
}

export function setWasmViewport(v) {
  viewport = { ...viewport, ...v };
  if (wasmModule?._set_viewport) {
    wasmModule._set_viewport(v.x || 0, v.y || 0, v.zoom || 1);
  }
}

export function requestRender() {
  if (!wasmInitialized || !wasmModule) return;
  if (renderFrameId) return;

  renderFrameId = requestAnimationFrame((timestamp) => {
    renderFrameId = null;
    if (wasmModule?._render) {
      wasmModule._render(timestamp);
    }
  });
}

export function getRenderMode() {
  return wasmInitialized ? 'wasm' : 'svg';
}

export function getWasmModule() {
  return wasmModule;
}