/**
 * Mobile shader optimisation patch.
 *
 * The spectral dispersion loop in the main render shader uses BANDS=32.
 * That means 32 texture lookups + spectrum math per fragment, per frame.
 * On a mobile GPU (Adreno 6xx / Mali-G7x) this saturates the shader cores
 * and causes the animation to drop well below 60fps.
 *
 * Fix: on touch/mobile devices we reduce BANDS to 8.
 * Visual impact: chromatic dispersion is very slightly less smooth —
 * completely invisible at 390px wide. All other effects (depth, bevel,
 * caustics, highlights, bloom, echo) are UNCHANGED.
 *
 * We patch the shader STRING before WebGL compiles it. The installed
 * component files are never modified.
 */

import { liquidGlassLogoRender, liquidGlassLogoComposite, liquidGlassLogoVertex } from './liquid-glass-logo-shaders';

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  // Fine-pointer = mouse. Coarse-pointer = touchscreen/stylus.
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth < 768;
  return coarse || narrow;
}

/** Returns patched shader sources for the current device. */
export function getPatchedShaders(): {
  render: string;
  composite: string;
  vertex: string;
} {
  if (!isMobileDevice()) {
    return {
      render: liquidGlassLogoRender,
      composite: liquidGlassLogoComposite,
      vertex: liquidGlassLogoVertex,
    };
  }

  // Mobile: drop spectral bands from 32 → 8
  // This reduces per-fragment work by 4× — the single biggest perf win
  // available without changing the visual design.
  const render = liquidGlassLogoRender
    .replace(/const int BANDS = 32;/, 'const int BANDS = 8;');

  return {
    render,
    composite: liquidGlassLogoComposite,
    vertex: liquidGlassLogoVertex,
  };
}
