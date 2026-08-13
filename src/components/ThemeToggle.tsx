import type { Mode } from '../lib/clearness';

interface Props {
  mode: Mode;
  onToggle: () => void;
}

/**
 * Shows the mode it will switch *to*, not the one in force — a button labelled
 * with its own destination. The label says so out loud for anyone who cannot
 * see which glyph is showing.
 */
export function ThemeToggle({ mode, onToggle }: Props) {
  const next = mode === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="bar__theme"
      onClick={onToggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {next === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 1.1v1.5M8 13.4v1.5M14.9 8h-1.5M2.6 8H1.1M12.88 3.12l-1.06 1.06M4.18 11.82l-1.06 1.06M12.88 12.88l-1.06-1.06M4.18 4.18L3.12 3.12" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.6 10.2A6.1 6.1 0 0 1 5.8 2.4a6.1 6.1 0 1 0 7.8 7.8Z"
      />
    </svg>
  );
}
