/**
 * Reading an hourly series at a fractional hour.
 *
 * Nothing here changes what the forecast says: at whole hours these return
 * exactly the published value. Between hours they are a straight line, which
 * is a rendering convenience for the transition and never a claim about
 * sub-hourly weather.
 */

/** Clamp a fractional index into an array's range. */
function clamp(pos: number, last: number): number {
  return Math.max(0, Math.min(pos, last));
}

/** Linear sample of an hourly series at a fractional index. */
export function sampleSeries(values: number[], pos: number): number {
  const last = values.length - 1;
  if (last < 0) return 0;
  const p = clamp(pos, last);
  const i = Math.floor(p);
  const j = Math.min(i + 1, last);
  return values[i] + (values[j] - values[i]) * (p - i);
}

export interface Lit {
  /** Where on the ramp this plant sits. Meaningless while `lit` is 0. */
  clearness: number;
  /** How lit the plant is, 0..1 — the fill's opacity. */
  lit: number;
}

/**
 * Clearness at a fractional hour, with the lit fraction alongside it.
 *
 * `null` clearness means there is not enough sun for the ratio to mean
 * anything, so it cannot be averaged with a real value. Crossing that boundary
 * holds the real hour's colour and moves `lit` instead, which is what makes a
 * plant fade in at first light rather than snap on at the bottom of the ramp.
 */
export function sampleClearness(values: (number | null)[], pos: number): Lit {
  const last = values.length - 1;
  if (last < 0) return { clearness: 0, lit: 0 };

  const p = clamp(pos, last);
  const i = Math.floor(p);
  const f = p - i;
  const a = values[i] ?? null;
  const b = values[Math.min(i + 1, last)] ?? null;

  if (a === null && b === null) return { clearness: 0, lit: 0 };
  if (a === null) return { clearness: b as number, lit: f };
  if (b === null) return { clearness: a, lit: 1 - f };
  return { clearness: a + (b - a) * f, lit: 1 };
}
