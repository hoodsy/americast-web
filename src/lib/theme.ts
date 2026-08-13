import { useCallback, useEffect, useState } from 'react';
import type { Mode } from './clearness';

export type Preference = 'system' | 'light' | 'dark';

const KEY = 'americast-theme';

function storedPreference(): Preference {
  const v = localStorage.getItem(KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function systemMode(): Mode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolves the active mode. CSS does its own theming from `data-theme` and
 * `prefers-color-scheme`; this exists because the map paints in JS and needs
 * the same answer the stylesheet arrived at.
 *
 * `system` is still the starting point — an untouched page follows the OS —
 * but it is not a state the toggle can return to. Once the reader picks a
 * side, that choice is what sticks.
 */
export function useTheme(): { mode: Mode; toggle: () => void } {
  const [preference, setPreference] = useState<Preference>(storedPreference);
  const [system, setSystem] = useState<Mode>(systemMode);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === 'system') {
      delete root.dataset.theme;
      localStorage.removeItem(KEY);
    } else {
      root.dataset.theme = preference;
      localStorage.setItem(KEY, preference);
    }
  }, [preference]);

  const mode: Mode = preference === 'system' ? system : preference;

  // Flips away from whatever is on screen, so the first click always visibly
  // changes something even when the preference is still inherited.
  const toggle = useCallback(() => {
    setPreference(mode === 'dark' ? 'light' : 'dark');
  }, [mode]);

  return { mode, toggle };
}
