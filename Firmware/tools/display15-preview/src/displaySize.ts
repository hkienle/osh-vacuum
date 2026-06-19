import { DISPLAY_SIDE_MM } from './types';

/** CSS px per inch at the standard 96 dpi reference. */
const CSS_PX_PER_INCH = 96;

/**
 * Browsers lay out CSS mm/in at the 96 dpi reference, but on HiDPI (macOS Retina)
 * that maps to less than true physical size on screen (~17 mm ruler vs 26.9 mm spec).
 * Scale layout px so the canvas matches the real 1.5″ panel when measured with a ruler.
 */
export function physicalSizeMultiplier(): number {
  const dpr = window.devicePixelRatio || 1;
  if (dpr < 1.25) {
    return 1;
  }
  /** Ruler measurement / spec side length at devicePixelRatio ≈ 2 (MacBook). */
  const measuredToSpecRatio = 17 / DISPLAY_SIDE_MM;
  const fullCorrection = 1 / measuredToSpecRatio;
  const dprBlend = Math.min(1, (dpr - 1) / 1);
  return 1 + (fullCorrection - 1) * dprBlend;
}

/** CSS layout width/height for one side of the 128×128 panel. */
export function displaySideCssPx(zoom: number): number {
  const sideMm = DISPLAY_SIDE_MM * zoom;
  const referencePx = (sideMm / 25.4) * CSS_PX_PER_INCH;
  return referencePx * physicalSizeMultiplier();
}

export function formatDisplaySizeHint(zoom: number): string {
  const sideMm = DISPLAY_SIDE_MM * zoom;
  const cssPx = Math.round(displaySideCssPx(zoom));
  if (zoom === 1) {
    return `128×128 px — ${DISPLAY_SIDE_MM.toFixed(1)} mm per side (1.5″ diagonal, ruler-sized @ ${cssPx}px)`;
  }
  return `128×128 px — ${DISPLAY_SIDE_MM.toFixed(1)} mm panel at ${zoom}× (${sideMm.toFixed(1)} mm, ${cssPx}px)`;
}
