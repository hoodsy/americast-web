import { formatLead, formatPacific } from '../lib/time';
import './Scrubber.css';

interface Props {
  validTimes: string[];
  runTime: string;
  cursor: number;
  playing: boolean;
  onSeek: (i: number) => void;
  onToggle: () => void;
}

/**
 * A native range input, deliberately: it is keyboard operable and
 * screen-reader sane without any work from us.
 *
 * The playhead itself lives in lib/playhead — this is only its handle. The
 * hour is not printed here; the readout directly above says it far louder.
 */
export function Scrubber({ validTimes, runTime, cursor, playing, onSeek, onToggle }: Props) {
  const last = validTimes.length - 1;
  const validTime = validTimes[cursor];

  return (
    <div className="scrub">
      <button
        type="button"
        className="scrub__play"
        onClick={onToggle}
        aria-label={playing ? 'Pause' : 'Play forecast'}
      >
        {playing ? (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <rect x="3" y="2.5" width="3.5" height="11" rx="1" fill="currentColor" />
            <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 2.6v10.8a.7.7 0 0 0 1.07.6l8.4-5.4a.7.7 0 0 0 0-1.2L5.07 2a.7.7 0 0 0-1.07.6Z" fill="currentColor" />
          </svg>
        )}
      </button>

      <input
        type="range"
        className="scrub__range"
        min={0}
        max={last}
        step={1}
        value={cursor}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Forecast hour"
        aria-valuetext={`${formatPacific(validTime)}, lead ${formatLead(runTime, validTime)}`}
      />
    </div>
  );
}
