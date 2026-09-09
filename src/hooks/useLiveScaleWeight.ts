import { useEffect, useState } from 'react';

import { streamWeightFromScale } from '../services/bleScale/adapter';

export type LiveScaleStatus = 'idle' | 'connecting' | 'live' | 'error';

export interface LiveScaleWeight {
  status: LiveScaleStatus;
  /** Most recent reading in grams, kept across reconnects — null until the first reading arrives. */
  grams: number | null;
  settled: boolean;
  error: string | null;
  /** Re-attempts the connection after a failure. No-op while already connecting/live. */
  reconnect: () => void;
}

/**
 * Keeps a live BLE connection to the paired food scale open for as long as
 * `enabled` is true, streaming weight readings as they arrive instead of
 * requiring a "Pull from Scale" tap each time. Automatically connects when
 * enabled flips true and disconnects on unmount or when enabled flips false.
 */
export function useLiveScaleWeight(enabled: boolean): LiveScaleWeight {
  const [status, setStatus] = useState<LiveScaleStatus>('idle');
  const [grams, setGrams] = useState<number | null>(null);
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

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
        setGrams(g);
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

  return { status, grams, settled, error, reconnect: () => setAttempt((n) => n + 1) };
}
