import { Platform } from 'react-native';
import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import { todayLogDateKey } from '../../utils/date';

/**
 * Steps and calories burned, read from Android's Health Connect (Android
 * only — there is no equivalent on iOS in this app). Samsung Health and
 * most other fitness trackers write into Health Connect automatically, so
 * this never talks to a specific vendor app directly. Every method here
 * catches its own errors and returns a plain result instead of throwing.
 */

const READ_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
  { accessType: 'read', recordType: 'TotalCaloriesBurned' },
];

let initializedOk = false;

async function ensureInitialized(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (initializedOk) return true;
  try {
    initializedOk = await initialize();
    return initializedOk;
  } catch {
    return false;
  }
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function hasHealthConnectAccess(): Promise<boolean> {
  try {
    if (!(await ensureInitialized())) return false;
    const granted = await getGrantedPermissions();
    return granted.some((p) => 'recordType' in p && p.recordType === 'Steps');
  } catch {
    return false;
  }
}

export async function requestHealthConnectAccess(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    if (!(await isHealthConnectAvailable())) {
      return {
        ok: false,
        error: 'Health Connect is not available on this device. Install it from the Play Store, then try again.',
      };
    }
    if (!(await ensureInitialized())) {
      return { ok: false, error: 'Could not start Health Connect.' };
    }
    const granted = await requestPermission(READ_PERMISSIONS);
    const hasSteps = granted.some((p) => 'recordType' in p && p.recordType === 'Steps');
    if (!hasSteps) {
      return { ok: false, error: 'Permission to read steps was not granted.' };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to connect to Health Connect' };
  }
}

/** Opens Health Connect's own app so the user can review/revoke access — the library's documented way to disconnect, since revoking from inside the app only takes effect after a restart. */
export function openHealthConnectManagement(): void {
  openHealthConnectSettings();
}

function dayRange(dateKey: string): { startTime: string; endTime: string } {
  const startTime = new Date(`${dateKey}T00:00:00`).toISOString();
  const endTime =
    dateKey === todayLogDateKey() ? new Date().toISOString() : new Date(`${dateKey}T23:59:59.999`).toISOString();
  return { startTime, endTime };
}

export interface DailyActivity {
  steps: number | null;
  caloriesBurned: number | null;
  /** Active-calories reads are known to sometimes come back empty even with real data (community-reported library issue); falls back to total calories burned (includes resting metabolism) when that happens. */
  caloriesSource: 'active' | 'total' | null;
  /**
   * App package names that contributed to the steps total (e.g. Samsung
   * Health, a paired watch app, Google Fit if also installed). Health
   * Connect sums every contributing source without deduplicating overlap
   * between them, so more than one entry here is the most likely cause of
   * a steps total that doesn't match a single source app. Temporary
   * diagnostic — surfaced in the UI until the real cause is confirmed.
   */
  stepsDataOrigins: string[];
}

export async function getDailyActivity(dateKey: string): Promise<DailyActivity> {
  const empty: DailyActivity = { steps: null, caloriesBurned: null, caloriesSource: null, stepsDataOrigins: [] };
  try {
    if (!(await ensureInitialized())) return empty;
    const timeRangeFilter = { operator: 'between' as const, ...dayRange(dateKey) };

    const [stepsResult, activeResult] = await Promise.all([
      aggregateRecord({ recordType: 'Steps', timeRangeFilter }).catch(() => null),
      aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter }).catch(() => null),
    ]);

    const steps = stepsResult?.COUNT_TOTAL ?? null;
    const stepsDataOrigins = stepsResult?.dataOrigins ?? [];
    const activeCalories = activeResult?.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? null;

    if (activeCalories != null && activeCalories > 0) {
      return { steps, caloriesBurned: activeCalories, caloriesSource: 'active', stepsDataOrigins };
    }

    const totalResult = await aggregateRecord({ recordType: 'TotalCaloriesBurned', timeRangeFilter }).catch(() => null);
    const totalCalories = totalResult?.ENERGY_TOTAL?.inKilocalories ?? null;
    if (totalCalories != null && totalCalories > 0) {
      return { steps, caloriesBurned: totalCalories, caloriesSource: 'total', stepsDataOrigins };
    }

    return { steps, caloriesBurned: null, caloriesSource: null, stepsDataOrigins };
  } catch {
    return empty;
  }
}
