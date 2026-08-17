/**
 * The statewide forecast, straight off S3.
 *
 * This is a different product from the map API in `client.ts`, and the
 * important difference is operational rather than shaped: these are three
 * static objects behind plain HTTPS, refreshed once a day, with no server
 * anywhere in the path. The map needs an origin; this does not. So this is
 * what the page can be honest about before anything is deployed.
 *
 * Every array in a forecast is parallel to `valid_times`. Index `i` describes
 * the hour that *starts* at `valid_times[i]`, as a mean over that hour. Index
 * them together; never match on a timestamp.
 */

const PUBLIC_BASE: string =
  import.meta.env.VITE_FORECAST_BASE ??
  'https://americast-data.s3.us-west-2.amazonaws.com/americast/public';

/** Beyond this the daily cron has almost certainly failed. */
export const STALE_AFTER_HOURS = 26;

export interface Region {
  id: string;
  name: string;
  kind: string;
  /** Render local time with this. Never assume Pacific — region two will not be. */
  timezone: string;
  /** False means forecast-but-unverifiable, and must not look identical to true. */
  graded: boolean;
  forecast: string;
  scoreboard: string;
}

export interface RegionsResponse {
  schema_version: number;
  generated_at: string;
  regions: Region[];
}

/**
 * The recent track record. Absent until grading has something to say — it was
 * `null` for the first day and populated on 2026-08-17.
 *
 * Every field is optional on purpose. This shape was read off the live object
 * rather than from a published schema, so the renderer degrades to whatever is
 * actually there instead of asserting fields it has only ever seen once.
 */
export interface Accuracy {
  /** Length of the rolling window, in days. */
  window_days?: number;
  /** Mean absolute error over the window. */
  mae_mw?: number;
  /** Signed error: negative means the forecast runs low. */
  bias_mw?: number;
  /** Share of hours the p10–p90 band actually contained. Target is 0.8. */
  coverage?: number;
  /** How many hours the numbers above are computed from. */
  graded_hours?: number;
}

/**
 * Below this the record is too short to characterise anything, and quoting it
 * without saying so would dress up nine hours as a track record. A week.
 */
export const THIN_RECORD_HOURS = 168;

export interface ForecastResponse {
  schema_version: number;
  region: Region;
  units: string;
  level: string;
  validated: boolean;
  /** The weather model's cycle. */
  run_time: string;
  /** When we computed it — the one that goes stale. */
  generated_at: string;
  valid_times: string[];
  lead_hours: number[];
  /** The forecast line. */
  p50_mw: number[];
  /** The band around it. Currently under-covering; it calibrates itself. */
  p10_mw: number[];
  p90_mw: number[];
  /** Pure physics, no learning. */
  physical_mw: number[];
  /** What a cloudless sky would give — the ceiling. */
  clear_sky_mw: number[];
  peak: { valid_time: string; p50_mw: number };
  accuracy: Accuracy | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return (await res.json()) as T;
}

export function fetchRegions(): Promise<RegionsResponse> {
  return getJson<RegionsResponse>(`${PUBLIC_BASE}/regions.json`);
}

/**
 * `path` comes from the index, not from here. Hardcoding `caiso/` is exactly
 * what stops a second region appearing without a deploy.
 */
export function fetchForecast(path: string): Promise<ForecastResponse> {
  return getJson<ForecastResponse>(`${PUBLIC_BASE}/${path}`);
}

/** Hours since the forecast was computed, for spotting a failed cron. */
export function ageHours(generatedAt: string): number {
  return (Date.now() - Date.parse(generatedAt)) / 3_600_000;
}
