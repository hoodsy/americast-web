/**
 * The playhead: one fractional position along the forecast hours, shared by
 * every view that moves.
 *
 * The forecast itself is hourly and never invented between hours — this only
 * governs how the views travel from one hour to the next. Playback advances
 * the position continuously rather than stepping it, so the map dissolves
 * across the hour instead of cutting; a keyboard step eases; and anything
 * further than a step lands at once, because easing across ten hours is a
 * slideshow of hours nobody asked to see.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Forecast hours crossed per second of wall clock while playing. Slow enough
 * that a cloud band crossing the state can actually be followed — a 48-hour
 * run takes a little over half a minute.
 */
const HOURS_PER_SECOND = 1.4;

/** How long a single-hour step takes to settle. */
const STEP_MS = 300;

/** A seek further than this is a jump, not a step, and lands instantly. */
const STEP_LIMIT = 1.001;

/** A backgrounded tab hands back one enormous frame; this caps the leap. */
const MAX_FRAME_S = 0.1;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export interface Playhead {
  /** Fractional hour — what the map and the readouts animate against. */
  pos: number;
  /** The hour the reader is on: `pos` rounded, for labels and exact lookups. */
  cursor: number;
  playing: boolean;
  /** Move to an hour, easing if it is a single step away. */
  seek: (to: number) => void;
  /** Land on an hour with no animation — for a freshly loaded run. */
  jump: (to: number) => void;
  toggle: () => void;
  /**
   * Start playing without being asked. Distinct from `toggle` because motion
   * nobody requested is motion some readers cannot have: this is a no-op under
   * prefers-reduced-motion, where pressing play still works fine.
   */
  autoplay: () => void;
}

export function usePlayhead(last: number): Playhead {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  /**
   * Bumped to restart the frame loop when a tween begins. The tween itself
   * lives in a ref, so starting one costs no render of its own.
   */
  const [wake, setWake] = useState(0);

  const posRef = useRef(0);
  const playingRef = useRef(false);
  const tween = useRef<{ from: number; to: number; t0: number } | null>(null);

  const reduced = useRef(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = q.matches;
    const onChange = () => {
      reduced.current = q.matches;
    };
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);

  /**
   * Playback and tweening both read their live state from refs rather than
   * from the render that started them: a seek has to take effect on the very
   * next frame, not on the next render, or the loop advances past where the
   * reader just asked to be.
   */
  const setPlay = useCallback((v: boolean) => {
    playingRef.current = v;
    setPlaying(v);
  }, []);

  const land = useCallback((to: number) => {
    tween.current = null;
    posRef.current = to;
    setPos(to);
  }, []);

  useEffect(() => {
    if (!playingRef.current && !tween.current) return;

    let frame = 0;
    let prev = performance.now();

    const step = (now: number) => {
      const dt = Math.min((now - prev) / 1000, MAX_FRAME_S);
      prev = now;

      if (tween.current) {
        const { from, to, t0 } = tween.current;
        const k = Math.min(1, (now - t0) / STEP_MS);
        posRef.current = from + (to - from) * easeOutCubic(k);
        if (k >= 1) {
          posRef.current = to;
          tween.current = null;
        }
      } else if (playingRef.current) {
        posRef.current += dt * HOURS_PER_SECOND;
        if (posRef.current >= last) {
          posRef.current = last;
          setPlay(false);
        }
      } else {
        return; // seeked away mid-flight; nothing left to drive
      }

      // Under reduced motion the position still advances, but it reaches the
      // views only on whole hours, so playback steps rather than glides.
      setPos(reduced.current ? Math.round(posRef.current) : posRef.current);
      if (playingRef.current || tween.current) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, last, wake, setPlay]);

  const seek = useCallback(
    (to: number) => {
      setPlay(false);
      const from = posRef.current;
      if (reduced.current || Math.abs(to - from) > STEP_LIMIT) {
        land(to);
        return;
      }
      tween.current = { from, to, t0: performance.now() };
      setWake((w) => w + 1);
    },
    [land, setPlay],
  );

  const jump = useCallback(
    (to: number) => {
      setPlay(false);
      land(to);
    },
    [land, setPlay],
  );

  const toggle = useCallback(() => {
    // Replaying from the end restarts rather than sitting on the last hour.
    if (!playingRef.current && posRef.current >= last) land(0);
    setPlay(!playingRef.current);
  }, [last, land, setPlay]);

  const autoplay = useCallback(() => {
    if (reduced.current) return;
    setPlay(true);
  }, [setPlay]);

  const cursor = Math.max(0, Math.min(Math.round(pos), Math.max(last, 0)));

  return { pos, cursor, playing, seek, jump, toggle, autoplay };
}
