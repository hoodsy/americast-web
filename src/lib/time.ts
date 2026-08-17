/**
 * Every timestamp from the API is UTC. We display in Pacific, but never do
 * arithmetic in it — differences are taken on epoch milliseconds, and the
 * time zone only ever enters at the formatting step.
 *
 * Clocks read as 12-hour with AM/PM. The date half stays day-month
 * ("Saturday 15 Jun"), so the two are composed from separate formatters
 * rather than pulled out of one locale's idea of how to join them.
 */

/**
 * The zone every formatter here renders in. It is module state, set once from
 * the region being shown, because the alternative is threading a timezone
 * through several dozen call sites that all want the same answer. One region
 * is on screen at a time, so one zone is the right scope.
 *
 * Pacific is the starting value, not an assumption — `setZone` overwrites it
 * as soon as the index says what the region actually uses.
 */
let zone = 'America/Los_Angeles';

function build() {
  return {
    dateOnly: new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }),
    timeOnly: new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    /** No minutes — for axis ticks, where "12 PM" is all the room there is. */
    hourOnly: new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hour12: true,
    }),
    dayNumber: new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }),
    hour24: new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: 'numeric',
      hour12: false,
    }),
  };
}

let fmt = build();

/** Point every formatter at a region's own zone. Safe to call repeatedly. */
export function setZone(tz: string): void {
  if (!tz || tz === zone) return;
  zone = tz;
  fmt = build();
}

/** The zone currently in force, for anything that needs to label it. */
export function currentZone(): string {
  return zone;
}

/** "Saturday 15 Jun, 11:00 AM PT" */
export function formatPacific(iso: string): string {
  return `${formatPacificDate(iso)}, ${formatPacificTime(iso)} PT`;
}

/** "Saturday 15 Jun" */
export function formatPacificDate(iso: string): string {
  return fmt.dateOnly.format(new Date(iso));
}

/** "11:00 AM" */
export function formatPacificTime(iso: string): string {
  return fmt.timeOnly.format(new Date(iso));
}

/** "11 AM" */
export function formatPacificHour(iso: string): string {
  return fmt.hourOnly.format(new Date(iso));
}

/** "2024-06-15" in Pacific — for detecting local day boundaries on the axis. */
export function pacificDayKey(iso: string): string {
  return fmt.dayNumber.format(new Date(iso));
}

/**
 * The Pacific hour as 0..23, for tests like "is this local noon?" that must
 * not depend on how the clock happens to be spelled. Some engines render
 * midnight as "24" under hour12:false, hence the wrap.
 */
export function pacificHour(iso: string): number {
  return Number(fmt.hour24.format(new Date(iso))) % 24;
}

/** Whole hours between a run's issue time and a valid time. */
export function leadHours(runTime: string, validTime: string): number {
  const ms = new Date(validTime).getTime() - new Date(runTime).getTime();
  return Math.round(ms / 3_600_000);
}

/** "+12h" */
export function formatLead(runTime: string, validTime: string): string {
  const h = leadHours(runTime, validTime);
  return `${h >= 0 ? '+' : '−'}${Math.abs(h)}h`;
}
