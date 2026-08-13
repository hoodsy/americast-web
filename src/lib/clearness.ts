/**
 * The clearness ramp: blue → yellow → orange → red, cold meaning overcast and
 * hot meaning full sun.
 *
 * A note on what this ramp costs. Clearness is a magnitude, and magnitudes are
 * normally given a single-hue ramp precisely because hue has no natural order —
 * a reader cannot tell from the colours alone that orange outranks yellow, and
 * red/green colour deficiency collapses the warm half. This ramp is a
 * deliberate product choice for the heat metaphor, not a perceptual default.
 * Two things are done to soften it: lightness climbs steadily across the cold
 * half up to the yellow peak, and the warm half separates by chroma as much as
 * by hue. Exact values still have to be reachable as text, which is what the
 * tooltip is for.
 *
 * The scale is clamped at 1.0 for colour purposes only. Clearness values
 * slightly above 1 are real — broken cloud can reflect extra light onto a
 * panel — and are never rewritten, only rendered at the top step.
 */

export type Mode = 'light' | 'dark';

/** [position, colour] pairs. Positions must be ascending and span 0..1. */
export type RampStop = readonly [number, string];

export const RAMP: Record<Mode, readonly RampStop[]> = {
  light: [
    [0.0, '#1e3a8a'],
    [0.18, '#2f6fe0'],
    [0.36, '#7fb2f5'],
    [0.5, '#dfeaf7'],
    [0.62, '#ffe14d'],
    [0.78, '#ff9d2e'],
    [0.9, '#f4621f'],
    [1.0, '#d92b1f'],
  ],
  dark: [
    [0.0, '#1b3f8f'],
    [0.18, '#3a7ce8'],
    [0.36, '#79b4f7'],
    [0.5, '#d6e6f5'],
    [0.62, '#ffe14d'],
    [0.78, '#ffa63d'],
    [0.9, '#ff6f2c'],
    [1.0, '#ef3b2c'],
  ],
};

export const SURFACE: Record<Mode, string> = { light: '#fcfcfb', dark: '#1a1a19' };
export const MUTED = '#898781';
export const GRID: Record<Mode, string> = { light: '#e1e0d9', dark: '#2c2c2a' };

/**
 * The map's ground, in three steps of emphasis: the gridded void the land
 * floats on, the rest of the country, and California.
 *
 * The country is dimmed rather than omitted because it is orientation, not
 * data — no forecast is published for it. The steps have to survive being
 * seen through a grid, so they separate by value, not by hue.
 *
 * Mirrored as --map-* tokens in index.css for the parts CSS draws. Keep in step.
 */
export const VOID: Record<Mode, string> = { light: '#f8f8f5', dark: '#161615' };
export const DIM_LAND: Record<Mode, string> = { light: '#f1f0eb', dark: '#1e1e1d' };
export const DIM_EDGE: Record<Mode, string> = { light: '#e0dfd7', dark: '#2c2c2a' };
export const LAND: Record<Mode, string> = { light: '#fdfdfb', dark: '#262624' };
export const LAND_EDGE: Record<Mode, string> = { light: '#b6b3a8', dark: '#4d4c48' };

/** A plant with no meaningful sun: an empty outline, never a ramp colour. */
export const UNLIT: Record<Mode, string> = { light: '#b9b7b0', dark: '#55534e' };

/**
 * A MapLibre interpolate expression over the ramp. The map paints from feature
 * state, so this is the only place clearness becomes a colour — the value
 * itself is never rewritten, and `null` is handled by switching the fill off
 * rather than by painting the bottom of the ramp.
 */
export function rampExpression(mode: Mode): unknown[] {
  const out: unknown[] = ['interpolate', ['linear'], ['number', ['feature-state', 'clearness'], 0]];
  for (const [pos, hex] of RAMP[mode]) out.push(pos, hex);
  return out;
}

/** A CSS gradient of the ramp, for the legend. */
export function rampGradient(mode: Mode): string {
  const stops = RAMP[mode]
    .map(([pos, hex]) => `${hex} ${(pos * 100).toFixed(0)}%`)
    .join(', ');
  return `linear-gradient(to right, ${stops})`;
}
