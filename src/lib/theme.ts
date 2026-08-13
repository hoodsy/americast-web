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
 */
export function useTheme(): { mode: Mode; preference: Preference; cycle: () => void } {
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

  const cycle = useCallback(() => {
    setPreference((p) => (p === 'system' ? 'light' : p === 'light' ? 'dark' : 'system'));
  }, []);

  return { mode: preference === 'system' ? system : preference, preference, cycle };
}
