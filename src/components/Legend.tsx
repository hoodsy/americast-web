import { rampGradient, type Mode } from '../lib/clearness';
import { plantRadius } from '../lib/plants';

/** Reference circles for the size key — small, mid, and the largest plant. */
const SIZE_KEYS = [5, 100, 585.9];

export function Legend({ mode }: { mode: Mode }) {
  return (
    <div className="legend">
      <div className="legend__block">
        <div className="legend__label">Clearness</div>
        <div className="legend__ramp" style={{ background: rampGradient(mode) }} />
        {/* The scale's numbers are dropped on a phone, where the two ends
            would otherwise run into each other. What they name survives. */}
        <div className="legend__ends muted">
          <span>
            <span className="legend__end-n">{'0 · '}</span>overcast
          </span>
          <span>
            <span className="legend__end-n">{'1 · '}</span>clear sky
          </span>
        </div>
      </div>

      <div className="legend__block">
        <div className="legend__label">Capacity</div>
        <div className="legend__sizes">
          {SIZE_KEYS.map((mw) => (
            <div key={mw} className="legend__size">
              <span
                className="legend__dot"
                style={{ width: plantRadius(mw) * 2, height: plantRadius(mw) * 2 }}
              />
              <span className="legend__size-label muted tabular">{mw < 10 ? mw : Math.round(mw)}</span>
            </div>
          ))}
          <span className="legend__size-unit muted">MW</span>
        </div>
      </div>
    </div>
  );
}
