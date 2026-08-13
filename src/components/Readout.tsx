import { formatLead, formatPacificDate, formatPacificTime } from '../lib/time';
import './Readout.css';

interface Props {
  /** Statewide megawatts, already sampled at the playhead so it counts. */
  mw: number;
  /** The hour the reader is on. Never interpolated — the forecast is hourly. */
  validTime: string;
  runTime: string;
}

/**
 * The headline pair, sat directly on top of the scrubber: what the state is
 * making, and when. Everything else on the page is detail on these two.
 *
 * The megawatt figure travels with the playhead and the timestamp does not,
 * because a clock reading "13:24" would be claiming a forecast we do not have.
 * The number is a readout settling; the hour is a fact.
 */
export function Readout({ mw, validTime, runTime }: Props) {
  return (
    <div className="readout">
      <div className="readout__block">
        <div className="readout__value tabular">
          {Math.round(mw).toLocaleString('en-US')}
          <span className="readout__unit">MW</span>
        </div>
        <div className="readout__caption muted">Statewide solar output</div>
      </div>

      {/* Same shape as the block opposite: one figure carrying the weight,
          with its smaller qualifiers stacked around it. The date goes above
          rather than beside the clock so the hour reads as the headline. */}
      <div className="readout__block readout__block--when">
        <div className="readout__date muted tabular">{formatPacificDate(validTime)}</div>
        <div className="readout__when tabular">{formatPacificTime(validTime)}</div>
        <div className="readout__caption muted tabular">
          Pacific · {formatLead(runTime, validTime)} ahead
        </div>
      </div>
    </div>
  );
}
