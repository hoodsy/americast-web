import { useMemo, type ReactNode } from 'react';
import { area, line, curveMonotoneX } from 'd3-shape';
import { scaleLinear } from 'd3-scale';
import {
  formatLead,
  formatPacific,
  formatPacificHour,
  pacificDayKey,
  pacificHour,
} from '../lib/time';
import './Scrubber.css';

/**
 * Half the range thumb's width. Ticks, fill and the drawn thumb all inset by
 * this so they line up with where the native thumb's centre can actually
 * travel — without it every mark drifts against the handle towards the ends.
 */
const HALF_THUMB = 7;

/** Place a mark at a fraction of the thumb's actual travel. */
function at(frac: number): string {
  return `calc(${HALF_THUMB}px + (100% - ${HALF_THUMB * 2}px) * ${frac})`;
}

/** Height of the sparkline band, in the units its viewBox is drawn in. */
const SPARK_H = 28;

interface Props {
  validTimes: string[];
  runTime: string;
  /** The forecast line and the clear-sky ceiling behind it. */
  mw: number[];
  clearMw: number[];
  /** Fractional hour, so the fill and handle glide rather than step. */
  pos: number;
  cursor: number;
  onSeek: (i: number) => void;
}

/**
 * A ruler of hours you drag along. The native range input is still what the
 * reader operates — keyboard and screen readers get it for free — but its
 * track and thumb are made transparent and the visible timeline is drawn
 * underneath, which is the only way to get hourly ticks and a handle that
 * follows the fractional playhead rather than snapping between hours.
 */
export function Scrubber({
  validTimes,
  runTime,
  mw,
  clearMw,
  pos,
  cursor,
  onSeek,
}: Props) {
  const last = Math.max(validTimes.length - 1, 1);
  const validTime = validTimes[cursor];

  /**
   * The day's shape, drawn over the hours it belongs to. Same series and same
   * curve as the chart below the fold, so the reader is looking at a miniature
   * of it rather than a second, differently-shaped claim — but with no axes and
   * no numbers, because at twenty pixels tall the only readable thing is the
   * shape.
   *
   * Drawn in hour units and stretched to the track: x is the hour index, so
   * every peak sits exactly over its own tick whatever the deck's width.
   */
  const spark = useMemo(() => {
    // The ceiling is always >= the forecast, so it alone sets the top.
    const peak = Math.max(...clearMw, ...mw, 1);
    const y = scaleLinear().domain([0, peak]).range([SPARK_H, 0]);

    const toArea = area<number>()
      .x((_, i) => i)
      .y0(SPARK_H)
      .y1((d) => y(d))
      .curve(curveMonotoneX);
    const toLine = line<number>()
      .x((_, i) => i)
      .y((d) => y(d))
      .curve(curveMonotoneX);

    return {
      ceiling: toArea(clearMw) ?? '',
      forecast: toArea(mw) ?? '',
      edge: toLine(mw) ?? '',
    };
  }, [mw, clearMw]);

  /**
   * The marks never move, so they are built as elements once and held. The
   * playhead re-renders this component on every frame, and reconciling
   * forty-eight spans each time buys nothing.
   *
   * Every sixth hour is called out and labelled; midnight is called out
   * harder, because that is where one forecast day becomes the next.
   */
  const ticks = useMemo(() => {
    const out: ReactNode[] = [];

    validTimes.forEach((t, i) => {
      const hour = pacificHour(t);
      const dayStart = i > 0 && pacificDayKey(t) !== pacificDayKey(validTimes[i - 1]);
      const kind = dayStart || hour === 0 ? 'day' : hour % 6 === 0 ? 'six' : 'hour';
      const frac = i / last;

      out.push(
        <span key={t} className={`scrub__tick scrub__tick--${kind}`} style={{ left: at(frac) }} />,
      );

      if (kind === 'hour') return;

      // The end labels would hang off the track and collide with the play
      // button, so they tuck against the ends instead of centring.
      const edge =
        frac <= 0 ? { left: `${HALF_THUMB}px` } : frac >= 1 ? { right: `${HALF_THUMB}px` } : null;

      out.push(
        <span
          key={`${t}-label`}
          className={`scrub__hour${kind === 'day' ? ' scrub__hour--day' : ''}`}
          style={edge ?? { left: at(frac), transform: 'translateX(-50%)' }}
        >
          {formatPacificHour(t)}
        </span>,
      );
    });

    return out;
  }, [validTimes, last]);

  const played = Math.min(Math.max(pos / last, 0), 1);

  return (
    <div className="scrub">
      {/* Reads the two bands in the sparkline below. "Forecast", not
          "actual" — actuals are observed CAISO output, a different series
          this page does not carry. */}
      <p className="scrub__key muted">
        <span className="key key--forecast" /> Forecast
        <span className="key key--ceiling" /> Clear sky
      </p>

      <div className="scrub__track">
        <div className="scrub__ticks" aria-hidden="true">
          <svg
            className="scrub__spark"
            viewBox={`0 0 ${last} ${SPARK_H}`}
            preserveAspectRatio="none"
          >
            <defs>
              {/* Everything left of the playhead reads as covered ground. */}
              <clipPath id="scrub-played">
                <rect x="0" y="0" width={played * last} height={SPARK_H} />
              </clipPath>
            </defs>
            <path d={spark.ceiling} className="scrub__spark-ceiling" />
            <path d={spark.forecast} className="scrub__spark-ahead" />
            <path d={spark.forecast} className="scrub__spark-done" clipPath="url(#scrub-played)" />
            <path d={spark.edge} className="scrub__spark-edge" vectorEffect="non-scaling-stroke" />
          </svg>

          <span
            className="scrub__base"
            style={{ left: `${HALF_THUMB}px`, right: `${HALF_THUMB}px` }}
          />
          {ticks}
          <span
            className="scrub__fill"
            style={{ left: `${HALF_THUMB}px`, width: `calc((100% - ${HALF_THUMB * 2}px) * ${played})` }}
          />
          <span className="scrub__handle" style={{ left: at(played) }} />
        </div>

        <input
          type="range"
          className="scrub__range"
          min={0}
          max={validTimes.length - 1}
          step={1}
          value={cursor}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Forecast hour"
          aria-valuetext={`${formatPacific(validTime)}, lead ${formatLead(runTime, validTime)}`}
        />
      </div>
    </div>
  );
}
