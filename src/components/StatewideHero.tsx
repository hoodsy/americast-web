import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { area, line, curveMonotoneX } from 'd3-shape';
import type { ReactNode } from 'react';
import type { TotalsLevel } from '../api/types';
import { sampleSeries } from '../lib/series';
import { formatPacific, formatPacificHour, pacificDayKey, pacificHour } from '../lib/time';
import { useSize } from '../lib/useSize';
import './StatewideHero.css';

const M = { top: 16, right: 16, bottom: 26, left: 52 };

interface Props {
  state: TotalsLevel;
  validTimes: string[];
  runTime: string;
  /** Fractional hour — the cursor slides along the curve rather than hopping. */
  pos: number;
  cursor: number;
  /** Sits at the head's right edge — the run being charted is chosen here. */
  controls?: ReactNode;
}

export function StatewideHero({ state, validTimes, runTime, pos, cursor, controls }: Props) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const height = 240;

  const chart = useMemo(() => {
    if (width === 0) return null;

    const w = Math.max(width - M.left - M.right, 10);
    const h = height - M.top - M.bottom;

    // The ceiling is always >= the forecast, so it alone sets the top.
    const peak = Math.max(...state.clear_mw, ...state.mw, 1);
    const x = scaleLinear().domain([0, validTimes.length - 1]).range([0, w]);
    const y = scaleLinear().domain([0, peak]).nice().range([h, 0]);

    const toArea = area<number>()
      .x((_, i) => x(i))
      .y0(h)
      .y1((d) => y(d))
      .curve(curveMonotoneX);

    const toLine = line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(curveMonotoneX);

    // A tick wherever the Pacific day rolls over, plus local noon. Noon is
    // found by the hour number, not by the label, so the clock format stays
    // free to change.
    const dayTicks: { i: number; label: string }[] = [];
    let lastDay = '';
    validTimes.forEach((t, i) => {
      const day = pacificDayKey(t);
      if (day !== lastDay) {
        if (lastDay !== '') dayTicks.push({ i, label: formatPacificHour(t) });
        lastDay = day;
      } else if (pacificHour(t) === 12) {
        dayTicks.push({ i, label: formatPacificHour(t) });
      }
    });

    return {
      w,
      h,
      x,
      y,
      ceilingPath: toArea(state.clear_mw) ?? '',
      forecastPath: toArea(state.mw) ?? '',
      forecastLine: toLine(state.mw) ?? '',
      yTicks: y.ticks(4),
      dayTicks,
    };
  }, [width, state, validTimes]);

  // The dots ride the playhead so they stay on the curve; the sentence below
  // quotes the hour exactly, because prose rewritten 60 times a second cannot
  // be read.
  const mw = sampleSeries(state.mw, pos);
  const ceiling = sampleSeries(state.clear_mw, pos);
  const hourMw = state.mw[cursor] ?? 0;
  const hourCeiling = state.clear_mw[cursor] ?? 0;
  const shortfall = hourCeiling > 0 ? 1 - hourMw / hourCeiling : 0;

  return (
    <section className="hero">
      <header className="hero__head">
        <div>
          <h1 className="hero__title">Statewide solar forecast</h1>
          <p className="hero__sub muted">
            Run issued {formatPacific(runTime)} · CAISO balancing area
          </p>
        </div>
        {controls && <div className="hero__controls">{controls}</div>}
      </header>

      <div className="hero__chart" ref={ref}>
        {chart && (
          <svg width={width} height={height} role="img" aria-label={`Statewide forecast curve. ${Math.round(mw).toLocaleString('en-US')} megawatts at the cursor.`}>
            <g transform={`translate(${M.left},${M.top})`}>
              {chart.yTicks.map((t) => (
                <g key={t} transform={`translate(0,${chart.y(t)})`}>
                  <line x2={chart.w} className="hero__grid" />
                  <text x={-8} dy="0.32em" className="hero__axis tabular" textAnchor="end">
                    {t === 0 ? '0' : `${(t / 1000).toFixed(t >= 10000 ? 0 : 1)}k`}
                  </text>
                </g>
              ))}

              {chart.dayTicks.map((t) => (
                <g key={t.i} transform={`translate(${chart.x(t.i)},0)`}>
                  <line y2={chart.h} className="hero__grid hero__grid--day" />
                  <text y={chart.h + 16} className="hero__axis tabular" textAnchor="middle">
                    {t.label}
                  </text>
                </g>
              ))}

              <path d={chart.ceilingPath} className="hero__ceiling" />
              <path d={chart.forecastPath} className="hero__forecast" />
              <path d={chart.forecastLine} className="hero__forecast-line" />

              <g transform={`translate(${chart.x(pos)},0)`}>
                <line y2={chart.h} className="hero__cursor" />
                <circle cy={chart.y(ceiling)} r={2.5} className="hero__cursor-ceiling" />
                <circle cy={chart.y(mw)} r={4} className="hero__cursor-dot" />
              </g>
            </g>
          </svg>
        )}
      </div>

      <p className="hero__legend muted">
        <span className="key key--forecast" /> Forecast
        <span className="key key--ceiling" /> Clear-sky ceiling
        {hourCeiling > 0 && hourMw < hourCeiling && (
          <span className="hero__cost">
            Cloud is costing {Math.round(hourCeiling - hourMw).toLocaleString('en-US')} MW ·{' '}
            {(shortfall * 100).toFixed(0)}% of the ceiling at this hour
          </span>
        )}
      </p>
    </section>
  );
}
