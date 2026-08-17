/**
 * Types for the americast read-only API.
 *
 * Every array in a run payload is parallel to `valid_times`: index `i`
 * describes the hour that *starts* at `valid_times[i]`, as a mean over that
 * hour. All timestamps are UTC ISO-8601.
 */

/** ISO-8601 UTC instant, e.g. "2024-06-15T06:00:00Z". */
export type Utc = string;

export interface RunsResponse {
  runs: Utc[];
}

/**
 * Six, not five: `sonoran` arrived with Arizona when the plant registry moved
 * from filtering on the state line to filtering on the balancing authority.
 */
export type Zone =
  | 'kern'
  | 'mojave'
  | 'imperial'
  | 'central_valley'
  | 'coastal'
  | 'sonoran';

export interface Plant {
  plant_id: number;
  name: string;
  latitude: number;
  longitude: number;
  capacity_mw_ac: number;
  dc_capacity_mw: number;
  county: string;
  zone: Zone;
}

export interface PlantsResponse {
  plants: Plant[];
}

export interface PlantSeries {
  plant_id: number;
  /** Megawatts AC, always >= 0. */
  mw: number[];
  /**
   * Forecast output over clear-sky output at that plant and hour.
   * Roughly 0..1 but legitimately slightly above 1 — broken cloud can
   * reflect extra light onto a panel. `null` means there is not enough sun
   * for the ratio to mean anything, which is not the same as zero.
   */
  clearness: (number | null)[];
}

export interface RunPlantsResponse {
  run_time: Utc;
  valid_times: Utc[];
  plants: PlantSeries[];
}

export type LevelKind = 'state' | 'zone' | 'county';

export interface TotalsLevel {
  level: LevelKind;
  name: string;
  /** Only `state` is graded against published CAISO data. */
  validated: boolean;
  mw: number[];
  /** What this level would produce under a clear sky — the ceiling. */
  clear_mw: number[];
}

export interface RunTotalsResponse {
  run_time: Utc;
  valid_times: Utc[];
  levels: TotalsLevel[];
}

export type ApiErrorKind = 'not-found' | 'bad-timestamp' | 'unreachable' | 'other';

/** An API response we understood well enough to explain to the reader. */
export class ApiError extends Error {
  status: number;
  kind: ApiErrorKind;

  constructor(status: number, kind: ApiErrorKind, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.kind = kind;
  }
}
