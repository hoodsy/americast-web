import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPlants, fetchRunPlants } from './api/client';
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
import { setZone } from './lib/time';
import { REPO } from './lib/links';
import { useTheme } from './lib/theme';
import './App.css';

export default function App() {
  const { mode, toggle: toggleTheme } = useTheme();

  /**
   * Two sources, deliberately unequal. The forecast is three static objects on
   * S3 and is always there; the map needs an origin that is not deployed yet.
   * So the forecast decides whether the page works, and the map is something
   * the page gains when it can reach it.
   */
  const [region, setRegion] = useState<Region | null>(null);
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [plants, setPlants] = useState<Plant[] | null>(null);
  const [plantRun, setPlantRun] = useState<RunPlantsResponse | null>(null);

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
   * The map, asked for at the forecast's own run so the two halves describe
   * the same hours. Failure is silent on purpose: until the map API is
   * deployed this will fail for everyone, and a forecast with no map is still
   * the whole of what phase one promises.
   */
  useEffect(() => {
    if (!forecast) return;
    let live = true;

    Promise.all([fetchPlants(), fetchRunPlants(forecast.run_time)])
      .then(([p, r]) => {
        if (!live) return;
        setPlants(p.plants);
        setPlantRun(r);
      })
      .catch(() => {
        /* phase two */
      });

    return () => {
      live = false;
    };
  }, [forecast]);

  const series = useMemo(() => {
    const m = new Map<number, PlantSeries>();
    for (const s of plantRun?.plants ?? []) m.set(s.plant_id, s);
    return m;
  }, [plantRun]);

  /**
   * How far the map run's hours are shifted from the forecast's, matched on
   * the instant rather than the string — the two products spell UTC
   * differently. Null when the grids do not line up hour for hour, in which
   * case the plants are drawn unlit rather than drawn against the wrong hour.
   */
  const mapOffset = useMemo(() => {
    if (!forecast || !plantRun) return null;
    const epochs = plantRun.valid_times.map((t) => Date.parse(t));
    const start = epochs.indexOf(Date.parse(forecast.valid_times[0]));
    if (start < 0) return null;

    const aligned = forecast.valid_times.every(
      (t, i) => epochs[start + i] === Date.parse(t),
    );
    return aligned ? start : null;
  }, [forecast, plantRun]);

  const mapSeries = mapOffset === null ? new Map<number, PlantSeries>() : series;
  const mapPos = pos + (mapOffset ?? 0);
  const mapCursor = cursor + (mapOffset ?? 0);

  const stale = forecast ? ageHours(forecast.generated_at) > STALE_AFTER_HOURS : false;

  if (error) {
    return (
      <div className="app">
        <ErrorPanel message={error} />
      </div>
    );
  }

  const ready = forecast !== null;
  const hours = forecast?.valid_times.length ?? 0;

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
          plants={plants ?? []}
          series={mapSeries}
          validTimes={plantRun?.valid_times ?? forecast?.valid_times ?? []}
          pos={mapPos}
          cursor={mapCursor}
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
          <div className="deck__head">
            <h2 className="deck__title">
              {hours ? `${hours} hour forecast` : 'Forecast'}
              {region ? ` · ${region.name}` : ''}
            </h2>
            {stale && <span className="deck__stale">Forecast may be stale</span>}
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
                low={forecast.p10_mw}
                high={forecast.p90_mw}
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

          {/* The page is one screen, so the standing caveats have nowhere below
              to live. They have to be on the screen they qualify. */}
          <p className="deck__note muted">
            {forecast?.accuracy
              ? 'The statewide total is graded daily against published CAISO data.'
              : 'Not yet graded: the statewide total is checked against published CAISO data daily, but the p10–p90 band calibrates from 30 days of that history and does not have it yet, so it currently under-covers.'}{' '}
            Every plant on the map is a physical estimate that sums to the statewide total, not a
            separately graded forecast. Boundaries from the US Census.
          </p>
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
