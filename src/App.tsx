import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchPlants, fetchRun, fetchRuns } from './api/client';
import { ApiError, type Plant, type PlantSeries, type RunPlantsResponse, type RunTotalsResponse, type Utc } from './api/types';
import { Scrubber } from './components/Scrubber';
import { Readout } from './components/Readout';
import { PlantMap } from './components/PlantMap';
import { RunPicker } from './components/RunPicker';
import { ThemeToggle } from './components/ThemeToggle';
import { GithubLink } from './components/GithubLink';
import { usePlayhead } from './lib/playhead';
import { sampleSeries } from './lib/series';
import { REPO } from './lib/links';
import { useTheme } from './lib/theme';
import './App.css';

type RunKey = Utc | 'latest';

function runFromUrl(): RunKey {
  const v = new URLSearchParams(window.location.search).get('run');
  return v && v !== 'latest' ? v : 'latest';
}

export default function App() {
  const { mode, toggle: toggleTheme } = useTheme();

  const [runKey, setRunKey] = useState<RunKey>(runFromUrl);
  const [runs, setRuns] = useState<Utc[]>([]);
  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [data, setData] = useState<{ plants: RunPlantsResponse; totals: RunTotalsResponse } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  // One playhead, shared: the map, the curve and the readout all move off it.
  const { pos, cursor, playing, seek, jump, toggle, autoplay } = usePlayhead(
    (data?.totals.valid_times.length ?? 1) - 1,
  );

  // Only the first run of the session rolls by itself. Once the reader has
  // gone looking for a particular day, taking the playhead off them would be
  // taking it off someone who is using it.
  const didAutoplay = useRef(false);

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
        // Open at the start of the forecast, so playing it through means
        // watching all of it. Landed, not animated — there is nothing to
        // travel from on a run the reader has not seen.
        jump(0);
        // Then roll it, so the map is visibly a forecast rather than a
        // still. It plays through once and stops on the final hour.
        if (!didAutoplay.current) {
          didAutoplay.current = true;
          autoplay();
        }
      })
      .catch((e: unknown) => live && setError(e as ApiError));

    return () => {
      live = false;
    };
  }, [runKey, jump, autoplay]);

  const series = useMemo(() => {
    const m = new Map<number, PlantSeries>();
    for (const s of data?.plants.plants ?? []) m.set(s.plant_id, s);
    return m;
  }, [data]);

  const stateLevel = useMemo(
    () => data?.totals.levels.find((l) => l.level === 'state') ?? null,
    [data],
  );

  if (error) {
    return (
      <div className="app">
        <ErrorPanel error={error} runKey={runKey} onLatest={() => selectRun('latest')} />
      </div>
    );
  }

  const ready = plants !== null && data !== null && stateLevel !== null;
  // Stated from the payload, not assumed: the heading should not claim 48
  // hours if a run ever arrives shorter.
  const hours = data?.totals.valid_times.length ?? 0;

  return (
    <div className="app">
      {/* The first screen: the map is the ground, edge to edge, and the two
          things that read it float on top. The curve is the second look, and
          it waits below. */}
      <div className="stage">
        {ready ? (
          <PlantMap
            plants={plants}
            series={series}
            validTimes={data.plants.valid_times}
            pos={pos}
            cursor={cursor}
            mode={mode}
          />
        ) : (
          <div className="stage__loading skeleton" aria-busy="true" aria-label="Loading forecast" />
        )}

        <nav className="bar">
          <a className="bar__logo" href={REPO} target="_blank" rel="noreferrer">
            Americast
          </a>

          <div className="bar__tools">
            <GithubLink />
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
            <RunPicker
              runs={runs}
              runTime={data?.totals.run_time ?? runs[0] ?? ''}
              isLatest={runKey === 'latest'}
              onSelect={selectRun}
            />
          </div>
        </nav>

        {/* What is being shown and when, then the control that moves it —
            all above the map it drives. */}
        <section className="deck">
          <div className="deck__head">
            <h2 className="deck__title">{hours ? `${hours} hour forecast` : 'Forecast'}</h2>
          </div>

          {ready ? (
            <>
              <Readout
                mw={sampleSeries(stateLevel.mw, pos)}
                validTime={data.totals.valid_times[cursor]}
                runTime={data.totals.run_time}
              />
              <Scrubber
                validTimes={data.totals.valid_times}
                runTime={data.totals.run_time}
                mw={stateLevel.mw}
                clearMw={stateLevel.clear_mw}
                pos={pos}
                cursor={cursor}
                playing={playing}
                onSeek={seek}
                onToggle={toggle}
              />
            </>
          ) : (
            <DeckSkeleton />
          )}

          {/* The page is one screen now, so the standing caveat has nowhere
              below to live. It has to be on the screen it qualifies. */}
          <p className="deck__note muted">
            Statewide total graded daily against published CAISO data; every figure beneath it
            is a physical estimate that sums to it, not a separately graded forecast.
            Boundaries from the US Census.
          </p>
        </section>
      </div>
    </div>
  );
}

/** Holds the deck's height while a run is in flight, so nothing jumps. */
function DeckSkeleton() {
  return (
    <div className="loading__deck" aria-busy="true" aria-label="Loading forecast">
      <div className="skeleton" style={{ width: 210, height: 46 }} />
      <div className="skeleton" style={{ width: 150, height: 30 }} />
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
