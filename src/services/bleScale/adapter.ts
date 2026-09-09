import { getSettings, updateSettings } from '../../db/repositories/settingsRepo';
import { readWeightGrams, scanForScale } from './client';

const SCAN_TIMEOUT_MS = 15_000;
const READ_TIMEOUT_MS = 20_000;

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

export type ScaleWeightResult =
  | { ok: true; weightG: number; frames: string[] }
  | { ok: false; error: string; frames: string[] };

export async function readWeightFromScale(): Promise<ScaleWeightResult> {
  try {
    const paired = await getPairedScale();
    if (!paired) {
      return { ok: false, error: 'No food scale paired. Pair one in Settings first.', frames: [] };
    }
    const { grams, frames } = await readWeightGrams(paired.deviceId, READ_TIMEOUT_MS);
    if (grams == null) {
      return {
        ok: false,
        error: 'Could not get a reading from the scale. Make sure it is on, in range, and set to grams or oz.',
        frames,
      };
    }
    return { ok: true, weightG: grams, frames };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to read weight from scale', frames: [] };
  }
}
