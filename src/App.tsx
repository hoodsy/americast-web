import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchPlants, fetchRun, fetchRuns } from './api/client';
import { ApiError, type Plant, type PlantSeries, type RunPlantsResponse, type RunTotalsResponse, type Utc } from './api/types';
import { StatewideHero } from './components/StatewideHero';
import { Scrubber } from './components/Scrubber';
import { Readout } from './components/Readout';
import { PlantMap } from './components/PlantMap';
import { RunPicker } from './components/RunPicker';
import { usePlayhead } from './lib/playhead';
import { sampleSeries } from './lib/series';
import { useTheme } from './lib/theme';
import './App.css';

type RunKey = Utc | 'latest';

function runFromUrl(): RunKey {
  const v = new URLSearchParams(window.location.search).get('run');
  return v && v !== 'latest' ? v : 'latest';
}

export default function App() {
  const { mode, preference, cycle } = useTheme();

  const [runKey, setRunKey] = useState<RunKey>(runFromUrl);
  const [runs, setRuns] = useState<Utc[]>([]);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [data, setData] = useState<{ plants: RunPlantsResponse; totals: RunTotalsResponse } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // One playhead, shared: the map, the curve and the readout all move off it.
  const { pos, cursor, playing, seek, jump, toggle } = usePlayhead(
    (data?.totals.valid_times.length ?? 1) - 1,
  );

  // Bookmarkable runs, and a back button that behaves.
  useEffect(() => {
    const onPop = () => setRunKey(runFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const selectRun = useCallback((next: RunKey) => {
    const url = new URL(window.location.href);
    if (next === 'latest') url.searchParams.delete('run');
    else url.searchParams.set('run', next);
    window.history.pushState({}, '', url);
    setRunKey(next);
  }, []);

  useEffect(() => {
    fetchRuns()
      .then((r) => setRuns(r.runs))
      .catch(() => setRuns([])); // a missing run list is survivable; the run itself is not
  }, []);

  useEffect(() => {
    let live = true;
    fetchPlants()
      .then((r) => live && setPlants(r.plants))
      .catch((e: unknown) => live && setError(e as ApiError));
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);

    fetchRun(runKey)
      .then((r) => {
        if (!live) return;
        setData(r);
        // Open on the peak hour, so the first paint says something without
        // the reader having to touch anything. Landed, not animated — there is
        // nothing to travel from on a run the reader has not seen.
        const state = r.totals.levels.find((l) => l.level === 'state');
        const peak = state ? state.mw.indexOf(Math.max(...state.mw)) : 0;
        jump(peak < 0 ? 0 : peak);
      })
      .catch((e: unknown) => live && setError(e as ApiError));

    return () => {
      live = false;
    };
  }, [runKey, jump]);

  const series = useMemo(() => {
    const m = new Map<number, PlantSeries>();
    for (const s of data?.plants.plants ?? []) m.set(s.plant_id, s);
    return m;
  }, [data]);

  const stateLevel = useMemo(
    () => data?.totals.levels.find((l) => l.level === 'state') ?? null,
    [data],
  );

  const themeLabel = preference === 'system' ? 'Auto' : preference === 'light' ? 'Light' : 'Dark';

  if (error) {
    return (
      <div className="app">
        <ErrorPanel error={error} runKey={runKey} onLatest={() => selectRun('latest')} />
      </div>
    );
  }

  const ready = plants !== null && data !== null && stateLevel !== null;

  return (
    <div className="app">
      <div className="bar">
        <button type="button" className="bar__theme" onClick={cycle}>
          Theme: {themeLabel}
        </button>
      </div>

      {ready ? (
        <>
          <PlantMap
            plants={plants}
            series={series}
            validTimes={data.plants.valid_times}
            pos={pos}
            cursor={cursor}
            mode={mode}
          />
          {/* The headline figures and the control that moves them, between the
              two views they describe. */}
          <Readout
            mw={sampleSeries(stateLevel.mw, pos)}
            validTime={data.totals.valid_times[cursor]}
            runTime={data.totals.run_time}
          />
          <Scrubber
            validTimes={data.totals.valid_times}
            runTime={data.totals.run_time}
            cursor={cursor}
            playing={playing}
            onSeek={seek}
            onToggle={toggle}
          />
          <StatewideHero
            state={stateLevel}
            validTimes={data.totals.valid_times}
            runTime={data.totals.run_time}
            pos={pos}
            cursor={cursor}
            controls={
              <RunPicker
                runs={runs}
                runTime={data.totals.run_time}
                isLatest={runKey === 'latest'}
                onSelect={selectRun}
              />
            }
          />
        </>
      ) : (
        <LoadingSkeleton />
      )}

      <footer className="foot muted">
        The statewide total is checked daily against published CAISO data. Everything below it —
        each plant, and any county or zone figure — is a physical estimate that sums to that total,
        and is not separately graded, because no hourly per-plant truth is published anywhere.
        {' '}State boundary from the US Census via <code>usstatesgeojson</code>; the rest of the
        country, shown dimmed and carrying no forecast, from the US Census via{' '}
        <code>us-atlas</code>.
      </footer>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="loading" aria-busy="true" aria-label="Loading forecast">
      <div className="skeleton loading__map" />
      <div className="loading__hero">
        <div className="skeleton" style={{ width: 220, height: 20 }} />
        <div className="skeleton" style={{ width: 150, height: 42, marginTop: 12 }} />
        <div className="skeleton" style={{ width: '100%', height: 200, marginTop: 16 }} />
      </div>
    </div>
  );
}

function ErrorPanel({
  error,
  runKey,
  onLatest,
}: {
  error: ApiError;
  runKey: RunKey;
  onLatest: () => void;
}) {
  const title =
    error.kind === 'not-found'
      ? 'That run is no longer stored'
      : error.kind === 'bad-timestamp'
        ? 'That run timestamp is not valid'
        : error.kind === 'unreachable'
          ? 'Cannot reach the forecast API'
          : 'The forecast API returned an error';

  const body =
    error.kind === 'not-found'
      ? `There is no run issued at ${runKey}. Runs are added and retired as the backfill progresses.`
      : error.kind === 'bad-timestamp'
        ? `"${runKey}" is not an ISO-8601 UTC timestamp, so the API could not read it.`
        : error.kind === 'unreachable'
          ? error.message
          : error.message;

  return (
    <div className="error">
      <h1 className="error__title">{title}</h1>
      <p className="error__body muted">{body}</p>
      {error.kind === 'unreachable' ? (
        <pre className="error__code">uvicorn americast.api.app:app --reload</pre>
      ) : (
        <button type="button" className="error__action" onClick={onLatest}>
          Show the latest run
        </button>
      )}
    </div>
  );
}
