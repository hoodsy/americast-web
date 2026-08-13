import { useMemo } from 'react';
import type { Utc } from '../api/types';
import { formatPacificTime, pacificDayKey } from '../lib/time';
import './RunPicker.css';

interface Props {
  runs: Utc[];
  /** The run actually loaded, so the picker reflects what is on screen even
   *  when the URL asked for "latest". */
  runTime: Utc;
  isLatest: boolean;
  onSelect: (run: Utc | 'latest') => void;
}

/**
 * Runs are keyed by the Pacific date they were *issued*, matching the
 * "Run issued …" label on the hero. A 06:00 UTC run is issued at 22:00 or
 * 23:00 the previous Pacific evening, so its date here is that evening's.
 *
 * Two things the run list does not guarantee, per the API contract: runs are
 * not contiguous, and one Pacific day may carry several runs once the model
 * issues at 00/06/12/18 UTC. So a bare date is not enough to identify a run —
 * the time selector appears whenever a day holds more than one.
 */
export function RunPicker({ runs, runTime, isLatest, onSelect }: Props) {
  const byDay = useMemo(() => {
    const m = new Map<string, Utc[]>();
    for (const r of runs) {
      const key = pacificDayKey(r);
      const list = m.get(key);
      if (list) list.push(r);
      else m.set(key, [r]);
    }
    // Newest first within a day, so the default pick is the freshest run.
    for (const list of m.values()) list.sort((a, b) => (a < b ? 1 : -1));
    return m;
  }, [runs]);

  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);

  // Empty until the first run resolves. Intl throws on an invalid date, so the
  // picker has to tolerate having nothing selected yet rather than assume one.
  const selectedDay = runTime ? pacificDayKey(runTime) : '';
  const sameDayRuns = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  const missing = Boolean(selectedDay) && days.length > 0 && !byDay.has(selectedDay);

  /** Nearest stored day to a date with no run — gaps are expected. */
  const nearest = (day: string): string | undefined => {
    if (days.length === 0) return undefined;
    let best = days[0];
    let bestGap = Infinity;
    for (const d of days) {
      const gap = Math.abs(Date.parse(d) - Date.parse(day));
      if (gap < bestGap) {
        bestGap = gap;
        best = d;
      }
    }
    return best;
  };

  const pickDay = (day: string) => {
    if (!day) return;
    const exact = byDay.get(day);
    if (exact && exact.length > 0) {
      onSelect(exact[0]);
      return;
    }
    const near = nearest(day);
    if (near) onSelect((byDay.get(near) as Utc[])[0]);
  };

  return (
    <div className="runpick">
      <label className="runpick__field">
        <span className="muted">Run issued</span>
        <input
          type="date"
          value={selectedDay}
          min={days[0] ?? undefined}
          max={days[days.length - 1] ?? undefined}
          onChange={(e) => pickDay(e.target.value)}
          disabled={days.length === 0 || !selectedDay}
          aria-label="Run issue date, Pacific"
        />
      </label>

      {sameDayRuns.length > 1 && (
        <label className="runpick__field">
          <span className="muted">at</span>
          <select value={runTime} onChange={(e) => onSelect(e.target.value)} aria-label="Run issue time">
            {sameDayRuns.map((r) => (
              <option key={r} value={r}>
                {formatPacificTime(r)} PT
              </option>
            ))}
          </select>
        </label>
      )}

      {!isLatest && (
        <button type="button" className="runpick__latest" onClick={() => onSelect('latest')}>
          Latest
        </button>
      )}

      {missing && (
        <span className="runpick__note muted">Nearest stored run shown — runs are not contiguous.</span>
      )}
    </div>
  );
}
