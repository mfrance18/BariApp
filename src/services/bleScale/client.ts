import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

import { decodeWeightUpdate, ESN00_NOTIFY_CHARACTERISTIC_UUID, ESN00_SERVICE_UUID } from './protocol';

const CONNECT_TIMEOUT_MS = 10_000;

let manager: BleManager | null = null;
function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

/** Releases the native BLE manager. Safe to call even if one was never created. */
export function destroyBleManager(): void {
  manager?.destroy();
  manager = null;
}

async function ensureBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Number(Platform.Version);
  const permissions =
    apiLevel >= 31
      ? [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const results = await PermissionsAndroid.requestMultiple(permissions);
  return Object.values(results).every((result) => result === PermissionsAndroid.RESULTS.GRANTED);
}

export interface ScannedScale {
  id: string;
  name: string | null;
}

/** Scans for a nearby ESN00 (advertising the nutrition-scale BLE service) for up to timeoutMs. */
export async function scanForScale(timeoutMs: number): Promise<ScannedScale | null> {
  const hasPermission = await ensureBlePermissions();
  if (!hasPermission) return null;

  const bleManager = getManager();

  return new Promise((resolve) => {
    let done = false;
    const finish = (result: ScannedScale | null) => {
      if (done) return;
      done = true;
      bleManager.stopDeviceScan().catch(() => {});
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    bleManager.startDeviceScan([ESN00_SERVICE_UUID], null, (error, device) => {
      if (error) {
        clearTimeout(timer);
        finish(null);
        return;
      }
      if (device) {
        clearTimeout(timer);
        finish({ id: device.id, name: device.name ?? device.localName ?? null });
      }
    });
  });
}

export interface ScaleWeightSubscription {
  unsubscribe: () => void;
}

/**
 * Connects to a previously paired scale by id and keeps the connection open,
 * calling onReading for every weight update (settling or settled) until
 * unsubscribed — this is what makes readings "live" instead of one-shot.
 * Resolves null if permission is denied or the initial connection fails, so
 * callers can always fall back to manual entry.
 */
export async function subscribeToScaleWeight(
  deviceId: string,
  onReading: (grams: number, settled: boolean) => void,
  onDisconnected: (error: string | null) => void,
): Promise<ScaleWeightSubscription | null> {
  const hasPermission = await ensureBlePermissions();
  if (!hasPermission) return null;

  const bleManager = getManager();
  try {
    const device = await bleManager.connectToDevice(deviceId, { timeout: CONNECT_TIMEOUT_MS });
    await device.discoverAllServicesAndCharacteristics();

    const disconnectSubscription = device.onDisconnected((error) => {
      onDisconnected(error?.message ?? null);
    });

    const notifySubscription = device.monitorCharacteristicForService(
      ESN00_SERVICE_UUID,
      ESN00_NOTIFY_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error || !characteristic?.value) return;
        const update = decodeWeightUpdate(characteristic.value);
        if (update) onReading(update.grams, update.settled);
      },
    );

    return {
      unsubscribe: () => {
        disconnectSubscription.remove();
        notifySubscription.remove();
        device.cancelConnection().catch(() => {});
      },
    };
  } catch {
    return null;
  }
}
