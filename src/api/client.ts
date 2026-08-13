import {
  ApiError,
  type PlantsResponse,
  type RunPlantsResponse,
  type RunTotalsResponse,
  type RunsResponse,
  type Utc,
} from './types';

const BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`);
  } catch {
    throw new ApiError(
      0,
      'unreachable',
      `Could not reach the forecast API at ${BASE}. Is it running?`,
    );
  }

  if (!res.ok) {
    if (res.status === 404) {
      throw new ApiError(404, 'not-found', 'No stored run at that time.');
    }
    if (res.status === 422) {
      throw new ApiError(422, 'bad-timestamp', 'That run timestamp is malformed.');
    }
    throw new ApiError(res.status, 'other', `The API returned ${res.status}.`);
  }

  return (await res.json()) as T;
}

/**
 * Caches keyed on run_time. A run's data never changes once stored, so
 * anything we have fetched stays good for the session. `/plants` is static
 * and shared across every run.
 */
const runPlantsCache = new Map<Utc, Promise<RunPlantsResponse>>();
const runTotalsCache = new Map<Utc, Promise<RunTotalsResponse>>();
let plantsCache: Promise<PlantsResponse> | undefined;

export function fetchRuns(): Promise<RunsResponse> {
  return get<RunsResponse>('/runs');
}

export function fetchPlants(): Promise<PlantsResponse> {
  plantsCache ??= get<PlantsResponse>('/plants').catch((err: unknown) => {
    plantsCache = undefined; // let a later mount retry
    throw err;
  });
  return plantsCache;
}

/** `run` may be a run_time or the literal "latest". */
export function fetchRunPlants(run: Utc | 'latest'): Promise<RunPlantsResponse> {
  const cached = runPlantsCache.get(run);
  if (cached) return cached;

  const p = get<RunPlantsResponse>(`/runs/${encodeURIComponent(run)}/plants`).catch(
    (err: unknown) => {
      runPlantsCache.delete(run);
      throw err;
    },
  );
  runPlantsCache.set(run, p);
  return p;
}

export function fetchRunTotals(run: Utc | 'latest'): Promise<RunTotalsResponse> {
  const cached = runTotalsCache.get(run);
  if (cached) return cached;

  const p = get<RunTotalsResponse>(`/runs/${encodeURIComponent(run)}/totals`).catch(
    (err: unknown) => {
      runTotalsCache.delete(run);
      throw err;
    },
  );
  runTotalsCache.set(run, p);
  return p;
}

/**
 * Both halves of one run. Resolving `latest` yields payloads stamped with a
 * concrete `run_time`, so we re-key the cache under it — a later request for
 * that same run by name then hits rather than refetching.
 */
export async function fetchRun(
  run: Utc | 'latest',
): Promise<{ plants: RunPlantsResponse; totals: RunTotalsResponse }> {
  const [plants, totals] = await Promise.all([fetchRunPlants(run), fetchRunTotals(run)]);

  if (run === 'latest') {
    if (!runPlantsCache.has(plants.run_time)) {
      runPlantsCache.set(plants.run_time, Promise.resolve(plants));
    }
    if (!runTotalsCache.has(totals.run_time)) {
      runTotalsCache.set(totals.run_time, Promise.resolve(totals));
    }
  }

  return { plants, totals };
}
