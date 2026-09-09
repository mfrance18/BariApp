import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';

import { decodeWeightNotification, ESN00_NOTIFY_CHARACTERISTIC_UUID, ESN00_SERVICE_UUID } from './protocol';

/** Flip on to log raw BLE notification bytes while debugging a real ESN00. */
const DEBUG_LOG_RAW_PACKETS = false;

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

/**
 * Connects to a previously paired scale by id, waits for a settled weight
 * reading, then disconnects. Resolves null on any failure (permission
 * denied, connection failure, timeout with no settled reading) rather than
 * throwing, so callers can always fall back to manual entry.
 */
export async function readWeightGrams(deviceId: string, timeoutMs: number): Promise<number | null> {
  const hasPermission = await ensureBlePermissions();
  if (!hasPermission) return null;

  const bleManager = getManager();
  let device: Device;
  try {
    device = await bleManager.connectToDevice(deviceId, { timeout: timeoutMs });
    await device.discoverAllServicesAndCharacteristics();
  } catch {
    return null;
  }

  return new Promise((resolve) => {
    let finished = false;
    let subscription: Subscription | null = null;

    const finish = (result: number | null) => {
      if (finished) return;
      finished = true;
      subscription?.remove();
      device.cancelConnection().catch(() => {});
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    subscription = device.monitorCharacteristicForService(
      ESN00_SERVICE_UUID,
      ESN00_NOTIFY_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (finished || error || !characteristic?.value) return;
        if (DEBUG_LOG_RAW_PACKETS) {
          console.log('[bleScale] raw notification', characteristic.value);
        }
        const grams = decodeWeightNotification(characteristic.value);
        if (grams != null) {
          clearTimeout(timer);
          finish(grams);
        }
      },
    );
  });
}
