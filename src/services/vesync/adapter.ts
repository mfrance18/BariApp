import * as SecureStore from 'expo-secure-store';

import { getSettings, updateSettings } from '../../db/repositories/settingsRepo';
import { upsertFromVeSync } from '../../db/repositories/weightRepo';
import {
  findScaleDevice,
  generateTerminalId,
  getLatestScaleReading,
  getScaleWeightHistory,
  listDevices,
  login as clientLogin,
  VeSyncAuthError,
} from './client';
import type { VeSyncCredentials, VeSyncDevice, VeSyncSession, WeightReading } from './types';

const KEYS = {
  password: 'vesync_password',
  token: 'vesync_token',
  accountId: 'vesync_account_id',
  terminalId: 'vesync_terminal_id',
  scaleDevice: 'vesync_scale_device',
} as const;

async function getOrCreateTerminalId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEYS.terminalId);
  if (existing) return existing;
  const generated = generateTerminalId();
  await SecureStore.setItemAsync(KEYS.terminalId, generated);
  return generated;
}

async function loadSession(): Promise<VeSyncSession | null> {
  const [token, accountId, terminalId] = await Promise.all([
    SecureStore.getItemAsync(KEYS.token),
    SecureStore.getItemAsync(KEYS.accountId),
    SecureStore.getItemAsync(KEYS.terminalId),
  ]);
  if (!token || !accountId || !terminalId) return null;
  return { token, accountId, terminalId };
}

async function loadScaleDevice(): Promise<VeSyncDevice | null> {
  const raw = await SecureStore.getItemAsync(KEYS.scaleDevice);
  return raw ? (JSON.parse(raw) as VeSyncDevice) : null;
}

async function clearStoredSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.password),
    SecureStore.deleteItemAsync(KEYS.token),
    SecureStore.deleteItemAsync(KEYS.accountId),
    SecureStore.deleteItemAsync(KEYS.scaleDevice),
  ]);
}

async function markDisconnected(): Promise<void> {
  await updateSettings({ vesyncConnected: false });
}

export async function login(credentials: VeSyncCredentials): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const terminalId = await getOrCreateTerminalId();
    const session = await clientLogin(credentials, terminalId);
    const devices = await listDevices(session);
    const scaleDevice = findScaleDevice(devices);

    if (!scaleDevice) {
      return { ok: false, error: 'Logged in, but no VeSync smart scale was found on this account.' };
    }

    await Promise.all([
      SecureStore.setItemAsync(KEYS.password, credentials.password),
      SecureStore.setItemAsync(KEYS.token, session.token),
      SecureStore.setItemAsync(KEYS.accountId, session.accountId),
      SecureStore.setItemAsync(KEYS.scaleDevice, JSON.stringify(scaleDevice)),
    ]);
    await updateSettings({ vesyncEmail: credentials.email, vesyncConnected: true });

    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Failed to connect to VeSync' };
  }
}

export async function logout(): Promise<void> {
  await clearStoredSession();
  await updateSettings({ vesyncConnected: false, vesyncEmail: null });
}

export async function isConnected(): Promise<boolean> {
  try {
    const settings = await getSettings();
    return settings.vesyncConnected;
  } catch {
    return false;
  }
}

/** Re-logs in using the cached email + password, refreshing the stored session token. */
async function reauthenticate(): Promise<VeSyncSession | null> {
  try {
    const [email, password] = await Promise.all([
      getSettings().then((s) => s.vesyncEmail),
      SecureStore.getItemAsync(KEYS.password),
    ]);
    if (!email || !password) return null;

    const terminalId = await getOrCreateTerminalId();
    const session = await clientLogin({ email, password }, terminalId);
    await Promise.all([
      SecureStore.setItemAsync(KEYS.token, session.token),
      SecureStore.setItemAsync(KEYS.accountId, session.accountId),
    ]);
    return session;
  } catch {
    return null;
  }
}

/** Runs a VeSync call, retrying once via re-authentication on an auth error, and never throwing. */
async function withSession<T>(
  fn: (session: VeSyncSession, device: VeSyncDevice) => Promise<T>,
): Promise<T | null> {
  try {
    const session = await loadSession();
    const device = await loadScaleDevice();
    if (!session || !device) return null;

    try {
      return await fn(session, device);
    } catch (error) {
      if (error instanceof VeSyncAuthError) {
        const refreshed = await reauthenticate();
        if (refreshed) {
          try {
            return await fn(refreshed, device);
          } catch {
            await markDisconnected();
            return null;
          }
        }
      }
      await markDisconnected();
      return null;
    }
  } catch {
    return null;
  }
}

export async function getLatestWeight(): Promise<WeightReading | null> {
  return withSession((session, device) => getLatestScaleReading(session, device));
}

export async function getWeightHistory(sinceDate: Date): Promise<WeightReading[]> {
  const result = await withSession((session, device) => getScaleWeightHistory(session, device, sinceDate));
  return result ?? [];
}

export async function syncWeightHistoryToDb(daysBack: number): Promise<{ synced: number }> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);

  const readings = await getWeightHistory(sinceDate);
  let synced = 0;
  for (const reading of readings) {
    const inserted = await upsertFromVeSync(reading);
    if (inserted) synced += 1;
  }
  return { synced };
}
