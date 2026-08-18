import './RunButton.css';

interface Props {
  playing: boolean;
  onToggle: () => void;
}

/**
 * The one control that moves the whole page, parked on the stage under the
 * nav rather than inside the deck. It drives the map as much as the timeline,
 * so it sits on the map's own ground, opposite the legend — the two things
 * floating over the geography are what to read and how to run it.
 *
 * Labelled rather than a bare glyph: a play triangle alone would be asking
 * the reader to guess whether it moves the clock or plays a video.
 */
export function RunButton({ playing, onToggle }: Props) {
  return (
    <button type="button" className="run" onClick={onToggle}>
      {playing ? (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <rect x="3" y="2.5" width="3.5" height="11" rx="1" fill="currentColor" />
          <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path
            d="M4 2.6v10.8a.7.7 0 0 0 1.07.6l8.4-5.4a.7.7 0 0 0 0-1.2L5.07 2a.7.7 0 0 0-1.07.6Z"
            fill="currentColor"
          />
        </svg>
      )}
      {playing ? 'Pause' : 'Run'}
    </button>
  );
}
