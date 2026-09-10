import { useEffect, useState } from 'react';

import { streamWeightFromScale } from '../services/bleScale/adapter';

export type LiveScaleStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface LiveScaleWeight {
  status: LiveScaleStatus;
  /** Most recent reading in grams, net of any active tare — null until the first reading arrives. */
  grams: number | null;
  settled: boolean;
  error: string | null;
  /** Re-attempts the connection after a failure. No-op while already connecting/live. */
  reconnect: () => void;
  /** Whether a tare (zero) is currently applied. */
  isTared: boolean;
  /** Zeroes the scale in software: the current raw reading becomes the new baseline, so a container's weight is subtracted from every reading after it. No-op until at least one reading has arrived. */
  tare: () => void;
  /** Clears an active tare, going back to showing the raw reading. */
  clearTare: () => void;
}

/**
 * Keeps a live BLE connection to the paired food scale open for as long as
 * `enabled` is true, streaming weight readings as they arrive instead of
 * requiring a "Pull from Scale" tap each time. Automatically connects when
 * enabled flips true and disconnects on unmount or when enabled flips false.
 *
 * The ESN00 only notifies weight over BLE — there's no known write command
 * to zero the scale in hardware — so taring is done in software here: it
 * remembers the raw reading at the moment of taring and subtracts it from
 * every reading after that, until cleared or a new connection starts.
 */
export function useLiveScaleWeight(enabled: boolean): LiveScaleWeight {
  const [status, setStatus] = useState<LiveScaleStatus>('idle');
  const [rawGrams, setRawGrams] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tareOffsetGrams, setTareOffsetGrams] = useState(0);

  useEffect(() => {
    setTareOffsetGrams(0);
  }, [enabled, attempt]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('connecting');
    setError(null);

    const subscriptionPromise = streamWeightFromScale({
      onReading: (g, isSettled) => {
        if (cancelled) return;
        setRawGrams(g);
        setSettled(isSettled);
        setStatus('live');
      },
      onDisconnected: (disconnectError) => {
        if (cancelled) return;
        setStatus('error');
        setError(disconnectError ?? 'Lost connection to the scale.');
      },
    }).then((result) => {
      if (cancelled) {
        result?.unsubscribe();
        return null;
      }
      if (!result) {
        setStatus('error');
        setError('Could not connect to the scale. Make sure it is on and in range.');
      }
      return result;
    });

    return () => {
      cancelled = true;
      subscriptionPromise.then((result) => result?.unsubscribe());
    };
  }, [enabled, attempt]);

  const grams = rawGrams == null ? null : Math.max(0, rawGrams - tareOffsetGrams);

  return {
    status,
    grams,
    settled,
    error,
    reconnect: () => setAttempt((n) => n + 1),
    isTared: tareOffsetGrams !== 0,
    tare: () => {
      if (rawGrams != null) setTareOffsetGrams(rawGrams);
    },
    clearTare: () => setTareOffsetGrams(0),
  };
}
