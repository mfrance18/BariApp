import * as Crypto from 'expo-crypto';

import type { VeSyncCredentials, VeSyncDevice, VeSyncSession, WeightReading } from './types';

/**
 * VeSync has no official public API for third-party apps. This client
 * reimplements the same cloud protocol used internally by the VeSync
 * mobile app and reverse-engineered by projects like `pyvesync` and Home
 * Assistant's `vesync` integration: a login handshake against
 * smartapi.vesync.com, a device list, and a generic "bypass" command
 * mechanism used to query/control most VeSync device categories.
 *
 * The login and device-list calls below follow the well-documented, stable
 * part of that protocol (identical across VeSync's whole device lineup).
 * The scale-specific reading command (`getWeighingDataV2`) and its response
 * shape are a best-effort implementation — VeSync's smart scale is a less
 * commonly reverse-engineered device category than their plugs/bulbs/
 * humidifiers, so this must be verified against a real account and scale
 * (see `DEBUG_LOG_RAW_RESPONSES` below) and adjusted if the field names or
 * value scaling differ from what's assumed here.
 */

const BASE_URL = 'https://smartapi.vesync.com';
const APP_VERSION = '5.4.62';
const PHONE_BRAND = 'BariApp';
const PHONE_OS = 'iOS';
const USER_TYPE = '1';
const ACCEPT_LANGUAGE = 'en';

/** Flip on to log raw VeSync responses to the Metro console while wiring up a real account/scale. */
export const DEBUG_LOG_RAW_RESPONSES = true;

function logDebug(label: string, data: unknown) {
  if (DEBUG_LOG_RAW_RESPONSES) {
    console.warn(`[VeSync debug] ${label}:`, JSON.stringify(data));
  }
}

async function md5Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}

export function generateTerminalId(): string {
  return Crypto.randomUUID();
}

interface VeSyncApiResponse<T> {
  code: number;
  msg?: string;
  result?: T;
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<VeSyncApiResponse<T>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as VeSyncApiResponse<T>;
  return data;
}

export class VeSyncAuthError extends Error {}

export async function login(
  credentials: VeSyncCredentials,
  terminalId: string,
): Promise<VeSyncSession> {
  const hashedPassword = await md5Hex(credentials.password);

  const data = await postJson<{ token: string; accountID: string }>('/cloud/v1/user/login', {
    email: credentials.email,
    password: hashedPassword,
    method: 'login',
    acceptLanguage: ACCEPT_LANGUAGE,
    appVersion: APP_VERSION,
    phoneBrand: PHONE_BRAND,
    phoneOS: PHONE_OS,
    terminalId,
    timeZone: 'America/New_York',
    traceId: String(Date.now()),
    userType: USER_TYPE,
    devToken: '',
  });

  logDebug('login response', data);

  if (data.code !== 0 || !data.result) {
    throw new VeSyncAuthError(data.msg ?? 'VeSync login failed');
  }

  return { token: data.result.token, accountId: data.result.accountID, terminalId };
}

export async function listDevices(session: VeSyncSession): Promise<VeSyncDevice[]> {
  const data = await postJson<{ list: VeSyncDevice[] }>('/cloud/v2/deviceManaged/devices', {
    method: 'devices',
    acceptLanguage: ACCEPT_LANGUAGE,
    appVersion: APP_VERSION,
    phoneBrand: PHONE_BRAND,
    phoneOS: PHONE_OS,
    accountID: session.accountId,
    token: session.token,
    terminalId: session.terminalId,
    timeZone: 'America/New_York',
    traceId: String(Date.now()),
    pageNo: 1,
    pageSize: 100,
  });

  logDebug('devices response', data);

  if (data.code !== 0 || !data.result) {
    if (data.code === -11201022 || data.code === -11012022) {
      throw new VeSyncAuthError(data.msg ?? 'VeSync session expired');
    }
    throw new Error(data.msg ?? 'Failed to list VeSync devices');
  }

  return data.result.list ?? [];
}

/** Heuristic match for a VeSync smart body scale in the device list. */
export function findScaleDevice(devices: VeSyncDevice[]): VeSyncDevice | null {
  return (
    devices.find(
      (d) =>
        d.deviceType?.toLowerCase().includes('scale') || d.deviceName?.toLowerCase().includes('scale'),
    ) ?? null
  );
}

interface RawScaleReading {
  weight?: number;
  weightG?: number;
  bodyFat?: number;
  time?: number;
  id?: string | number;
}

/** Normalizes VeSync's scale value (observed as grams, or kg×10, depending on device generation) into kg. */
export function normalizeWeightToKg(raw: number): number {
  if (raw > 1000) return raw / 1000; // looks like grams
  if (raw > 300) return raw / 10; // looks like kg * 10
  return raw; // already looks like kg
}

function toWeightReading(raw: RawScaleReading, fallbackId: string): WeightReading | null {
  const rawWeight = raw.weight ?? raw.weightG;
  if (rawWeight == null) return null;
  return {
    weightKg: normalizeWeightToKg(rawWeight),
    timestamp: raw.time ? new Date(raw.time * 1000) : new Date(),
    bodyFatPct: raw.bodyFat,
    externalId: raw.id != null ? String(raw.id) : fallbackId,
  };
}

async function bypassCommand<T>(
  session: VeSyncSession,
  device: VeSyncDevice,
  jsonCmd: Record<string, unknown>,
): Promise<T | null> {
  const data = await postJson<{ result?: T }>('/cloud/v1/deviceManaged/bypassV2', {
    method: 'bypassV2',
    acceptLanguage: ACCEPT_LANGUAGE,
    appVersion: APP_VERSION,
    phoneBrand: PHONE_BRAND,
    phoneOS: PHONE_OS,
    accountID: session.accountId,
    token: session.token,
    terminalId: session.terminalId,
    timeZone: 'America/New_York',
    traceId: String(Date.now()),
    cid: device.cid,
    uuid: device.uuid,
    configModule: device.configModule,
    jsonCmd,
  });

  logDebug(`bypassV2 ${Object.keys(jsonCmd)[0]} response`, data);

  if (data.code !== 0) {
    if (data.code === -11201022 || data.code === -11012022) {
      throw new VeSyncAuthError(data.msg ?? 'VeSync session expired');
    }
    return null;
  }

  return data.result?.result ?? null;
}

export async function getLatestScaleReading(
  session: VeSyncSession,
  device: VeSyncDevice,
): Promise<WeightReading | null> {
  const result = await bypassCommand<RawScaleReading>(session, device, { getWeighingDataV2: {} });
  if (!result) return null;
  return toWeightReading(result, `${device.cid}-latest`);
}

export async function getScaleWeightHistory(
  session: VeSyncSession,
  device: VeSyncDevice,
  sinceDate: Date,
): Promise<WeightReading[]> {
  const result = await bypassCommand<{ items?: RawScaleReading[] }>(session, device, {
    getWeighingDataV2: {
      beginDay: sinceDate.toISOString().slice(0, 10).replace(/-/g, ''),
      endDay: new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    },
  });

  const items = result?.items;
  if (!items || items.length === 0) {
    // History query shape is unconfirmed — fall back to at least the latest single reading.
    const latest = await getLatestScaleReading(session, device);
    return latest ? [latest] : [];
  }

  return items
    .map((item, index) => toWeightReading(item, `${device.cid}-${index}`))
    .filter((r): r is WeightReading => r !== null);
}
