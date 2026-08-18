import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPlants, fetchRunPlants, fetchRuns } from './api/client';
import {
  ageHours,
  fetchForecast,
  fetchRegions,
  STALE_AFTER_HOURS,
  type ForecastResponse,
  type Region,
} from './api/forecast';
import type { Plant, PlantSeries, RunPlantsResponse } from './api/types';
import { Scrubber } from './components/Scrubber';
import { Readout } from './components/Readout';
import { PlantMap } from './components/PlantMap';
import { ThemeToggle } from './components/ThemeToggle';
import { GithubLink } from './components/GithubLink';
import { usePlayhead } from './lib/playhead';
import { sampleSeries } from './lib/series';
import { formatPacificDate, setZone } from './lib/time';
import { REPO } from './lib/links';
import { useTheme } from './lib/theme';
import './App.css';

export default function App() {
  const { mode, toggle: toggleTheme } = useTheme();

  /**
   * Two objects, one run. Both halves are published by the same job each
   * morning, so the map is the forecast's own run rather than whatever the
   * per-plant store happened to reach. The forecast still decides whether the
   * page works: a run issued before the job began storing its weather has no
   * map, and the page is honest with bare geography underneath.
   */
  const [region, setRegion] = useState<Region | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [mapRun, setMapRun] = useState<RunPlantsResponse | null>(null);

  // One playhead, shared: the map, the sparkline and the readout move off it.
  const { pos, cursor, playing, seek, jump, toggle, autoplay } = usePlayhead(
    (forecast?.valid_times.length ?? 1) - 1,
  );

  const didAutoplay = useRef(false);

  useEffect(() => {
    let live = true;

    fetchRegions()
      .then((index) => {
        const first = index.regions[0];
        if (!first) throw new Error('The region index is empty.');
        if (!live) return null;
        setRegion(first);
        // Before any timestamp is rendered — the region owns its own clock.
        setZone(first.timezone);
        return fetchForecast(first.forecast);
      })
      .then((f) => {
        if (!live || !f) return;
        setForecast(f);
        jump(0);
        if (!didAutoplay.current) {
          didAutoplay.current = true;
          autoplay();
        }
      })
      .catch((e: unknown) => {
        if (live) setError(e instanceof Error ? e.message : String(e));
      });

    return () => {
      live = false;
    };
  }, [jump, autoplay]);

  /**
   * The map. Failure is silent on purpose: the deck stands on its own, and a
   * page with no map is still the whole of what phase one promises.
   */
  useEffect(() => {
    if (!forecast) return;
    let live = true;

    fetchPlants()
      .then((p) => live && setPlants(p.plants))
      .catch(() => undefined);

    // The forecast's own run, found in the index rather than spelled out
    // here — the index is what lets a second region or a second run hour a
    // day appear without a deploy. Matched on the instant, because the two
    // objects spell UTC differently and always have.
    fetchRuns()
      .then((index) => {
        const issued = Date.parse(forecast.run_time);
        const entry = index.runs.find((r) => Date.parse(r.run_time) === issued);
        if (!entry) return undefined;
        return fetchRunPlants(entry.path).then((r) => {
          if (live) setMapRun(r);
        });
      })
      .catch(() => undefined);

    return () => {
      live = false;
    };
  }, [forecast]);

  const series = useMemo(() => {
    const m = new Map<number, PlantSeries>();
    for (const s of mapRun?.plants ?? []) m.set(s.plant_id, s);
    return m;
  }, [mapRun]);

  /**
   * The map and the curve are the same run, so index i means the same hour in
   * both and there is no offset to carry. The length check is all that is
   * left of that: with nothing to plot the plants are dropped rather than
   * drawn unlit, because unlit is not "no data" in this map's language — it
   * means no meaningful sun, and a fleet of empty rings at midday would be a
   * false claim. Bare geography says the true thing.
   */
  const canPlot =
    forecast != null && mapRun?.valid_times.length === forecast.valid_times.length;
  const mapPlants = canPlot ? (plants ?? []) : [];

  const stale = forecast ? ageHours(forecast.generated_at) > STALE_AFTER_HOURS : false;

  if (error) {
    return (
      <div className="app">
        <ErrorPanel message={error} />
      </div>
    );
  }

  const ready = forecast !== null;

  /* The head carries only what qualifies the forecast — the run stamp lives
     with the reading below, so it is not said twice. */
  const notes = [stale ? 'may be stale' : ''].filter(Boolean);

  return (
    <div className="app">
      {/* The first screen: the map is the ground, edge to edge, and the two
          things that read it float on top. */}
      <div className="stage">
        {/* Always drawn, even with nothing to plot. Phase one ships without a
            map origin at all, and the geography with no plants on it is an
            honest ground for the deck — a skeleton that never resolves is
            not. */}
        <PlantMap
          plants={mapPlants}
          series={series}
          validTimes={forecast?.valid_times ?? []}
          pos={pos}
          cursor={cursor}
          mode={mode}
        />

        <nav className="bar">
          <a className="bar__logo" href={REPO} target="_blank" rel="noreferrer">
            Americast
          </a>

          <div className="bar__tools">
            <GithubLink />
            <ThemeToggle mode={mode} onToggle={toggleTheme} />
          </div>
        </nav>

        <section className="deck">
          {/* The date is hoisted out of the readout to sit on this line, so it
              rides at the same height as the title it is dated by. The hour
              below stays the headline; this only says which day it is. */}
          <div className="deck__head">
            <div className="deck__lede">
              <h2 className="deck__title">
                {ready ? '48 hour forecast' : 'Forecast'}
                {region ? ` · ${region.name}` : ''}
              </h2>
              {notes.length > 0 ? <span className="deck__run muted">{notes.join(' · ')}</span> : null}
            </div>
            {ready ? (
              <span className="deck__date muted tabular">
                {formatPacificDate(forecast.valid_times[cursor])}
              </span>
            ) : null}
          </div>

          {ready ? (
            <>
              <Readout
                mw={sampleSeries(forecast.p50_mw, pos)}
                peakMw={forecast.peak.p50_mw}
                validTime={forecast.valid_times[cursor]}
                runTime={forecast.run_time}
              />
              <Scrubber
                validTimes={forecast.valid_times}
                runTime={forecast.run_time}
                mw={forecast.p50_mw}
                clearMw={forecast.clear_sky_mw}
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
        </section>
      </div>
    </div>
  );
}

/** Holds the deck's height while the forecast is in flight, so nothing jumps. */
function DeckSkeleton() {
  return (
    <div className="loading__deck" aria-busy="true" aria-label="Loading forecast">
      <div className="skeleton" style={{ width: 210, height: 46 }} />
      <div className="skeleton" style={{ width: 150, height: 30 }} />
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="error">
      <h1 className="error__title">Cannot reach the forecast</h1>
      <p className="error__body muted">{message}</p>
      <p className="error__body muted">
        The forecast is published as static files and needs no server, so this usually means a
        network problem rather than an outage.
      </p>
    </div>
  );
}
