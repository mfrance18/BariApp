import { getSettings, updateSettings } from '../../db/repositories/settingsRepo';
import { scanForScale, subscribeToScaleWeight, type ScaleWeightSubscription } from './client';

const SCAN_TIMEOUT_MS = 15_000;

export interface PairedScale {
  deviceId: string;
  name: string | null;
}

/** Every method here catches its own errors and returns a plain result instead of throwing, so callers can always fall back to manual weight entry. */

export async function getPairedScale(): Promise<PairedScale | null> {
  try {
    const settings = await getSettings();
    if (!settings.bleScaleDeviceId) return null;
    return { deviceId: settings.bleScaleDeviceId, name: settings.bleScaleDeviceName ?? null };
  } catch {
    return null;
  }
}

export async function pairScale(): Promise<{ ok: true; scale: PairedScale } | { ok: false; error: string }> {
  try {
    const found = await scanForScale(SCAN_TIMEOUT_MS);
    if (!found) {
      return { ok: false, error: 'No scale found. Make sure it is powered on and nearby, then try again.' };
    }
    await updateSettings({ bleScaleDeviceId: found.id, bleScaleDeviceName: found.name });
    return { ok: true, scale: { deviceId: found.id, name: found.name } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to pair scale' };
  }
}

export async function unpairScale(): Promise<void> {
  try {
    await updateSettings({ bleScaleDeviceId: null, bleScaleDeviceName: null });
  } catch {
    // Nothing more to do if this fails — the paired scale simply stays paired.
  }
}

/**
 * Connects to the paired scale and streams weight readings for as long as
 * the returned subscription is kept open — used to show a live, continuously
 * updating reading instead of requiring a "Pull from Scale" tap each time.
 * Resolves null (rather than throwing) if no scale is paired or the initial
 * connection fails, so callers can always fall back to manual entry.
 */
export async function streamWeightFromScale(handlers: {
  onReading: (grams: number, settled: boolean) => void;
  onDisconnected: (error: string | null) => void;
}): Promise<ScaleWeightSubscription | null> {
  try {
    const paired = await getPairedScale();
    if (!paired) return null;
    return await subscribeToScaleWeight(paired.deviceId, handlers.onReading, handlers.onDisconnected);
  } catch {
    return null;
  }
}
