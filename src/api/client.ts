/**
 * The map, straight off S3.
 *
 * Once this pointed at a FastAPI origin on localhost that was never deployed,
 * which is why the map was blank for every visitor. The same job that writes
 * the statewide forecast now writes one directory per run beside it, so both
 * halves come from the same bucket, the same morning and the same run.
 *
 * `forecast.ts` is the other half of this pair. The split is by product, not
 * by transport: that module owns the graded statewide curve, this one owns
 * the per-plant detail underneath it.
 */

import {
  ApiError,
  type PlantsResponse,
  type RunPlantsResponse,
  type RunTotalsResponse,
  type Utc,
} from './types';

const PUBLIC_BASE: string =
  import.meta.env.VITE_FORECAST_BASE ??
  'https://americast-data.s3.us-west-2.amazonaws.com/americast/public';

/** One published run, as `runs.json` lists it. */
export interface RunEntry {
  run_time: Utc;
  /** Relative to PUBLIC_BASE, ending in a slash. Never build this yourself. */
  path: string;
  /** False while the run is still gaining actuals. */
  sealed: boolean;
  peak_mw: number;
  /** Null until the run has been graded. */
  mae_mw: number | null;
}

export interface RunIndex {
  schema_version: number;
  generated_at: string;
  region: string;
  runs: RunEntry[];
}

async function get(path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${PUBLIC_BASE}/${path}`);
  } catch {
    throw new ApiError(0, 'unreachable', `Could not reach ${path}.`);
  }
  // 403, not 404, is what a missing object looks like here. The bucket
  // policy grants anonymous GetObject and not ListBucket, so S3 answers
  // AccessDenied rather than NoSuchKey — it will not confirm that a key
  // is absent to someone who cannot list. Both mean the same thing to
  // this client: nobody published that object.
  if (res.status === 404 || res.status === 403) {
    throw new ApiError(res.status, 'not-found', 'That object is not published.');
  }
  if (!res.ok) {
    throw new ApiError(res.status, 'other', `${path} returned ${res.status}.`);
  }
  return res;
}

async function getJson<T>(path: string): Promise<T> {
  return (await (await get(path)).json()) as T;
}

/**
 * The compressed objects carry no `Content-Encoding` header, so the browser
 * will not unpack them for us: pyarrow cannot set that header, and adding a
 * second S3 client to the backend purely to fix it was not worth it. We
 * decompress here instead. See `docs/publish.md` in the backend repo.
 */
async function getGzipJson<T>(path: string): Promise<T> {
  const res = await get(path);
  if (!res.body) throw new ApiError(0, 'other', `${path} returned no body.`);
  const unpacked = res.body.pipeThrough(new DecompressionStream('gzip'));
  return (await new Response(unpacked).json()) as T;
}

/**
 * Caches keyed on the run's path. A run's map objects are published
 * `immutable` and never rewritten, so anything fetched stays good for the
 * session. `plants.json.gz` is static across runs and shared.
 */
const runPlantsCache = new Map<string, Promise<RunPlantsResponse>>();
const runTotalsCache = new Map<string, Promise<RunTotalsResponse>>();
let plantsCache: Promise<PlantsResponse> | undefined;

export function fetchRuns(): Promise<RunIndex> {
  return getJson<RunIndex>('caiso/runs.json');
}

export function fetchPlants(): Promise<PlantsResponse> {
  plantsCache ??= getGzipJson<PlantsResponse>('caiso/plants.json.gz').catch(
    (err: unknown) => {
      plantsCache = undefined; // let a later mount retry
      throw err;
    },
  );
  return plantsCache;
}

/** `path` comes from a RunEntry, never from here. */
export function fetchRunPlants(path: string): Promise<RunPlantsResponse> {
  const cached = runPlantsCache.get(path);
  if (cached) return cached;
  const pending = getGzipJson<RunPlantsResponse>(`${path}plants.json.gz`);
  runPlantsCache.set(path, pending);
  return pending;
}

export function fetchRunTotals(path: string): Promise<RunTotalsResponse> {
  const cached = runTotalsCache.get(path);
  if (cached) return cached;
  const pending = getJson<RunTotalsResponse>(`${path}totals.json`);
  runTotalsCache.set(path, pending);
  return pending;
}
