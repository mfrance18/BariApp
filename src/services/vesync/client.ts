import * as Crypto from 'expo-crypto';

import type { VeSyncCredentials, VeSyncDevice, VeSyncSession, WeightReading } from './types';

/**
 * VeSync has no official public API for third-party apps. This client
 * reimplements the same cloud protocol used internally by the VeSync
 * mobile app and reverse-engineered by projects like `pyvesync` and Home
 * Assistant's `vesync` integration: a two-step login handshake against
 * smartapi.vesync.com, a device list, and a generic "bypass" command
 * mechanism used to query/control most VeSync device categories.
 *
 * VeSync migrated login to a two-step "authorize code" flow (see `login`
 * below) — the older single-call `/cloud/v1/user/login` endpoint with an
 * MD5-hashed password is deprecated and now rejected with a misleading
 * "app version is too low" error regardless of the appVersion value sent.
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
const APP_VERSION = '5.6.60';
const APP_ID = 'eldodkfj';
const CLIENT_TYPE = 'vesyncApp';
const PHONE_BRAND = 'BariApp';
const PHONE_OS = 'iOS';
const USER_TYPE = '1';
const ACCEPT_LANGUAGE = 'en';
const REGION = 'US';
const TIME_ZONE = 'America/New_York';

/** A random per-install id VeSync's newer endpoints expect alongside terminalId. */
let cachedMobileId: string | null = null;
function getMobileId(): string {
  if (!cachedMobileId) {
    cachedMobileId = String(Math.floor(1_000_000_000_000_000 + Math.random() * 9_000_000_000_000_000));
  }
  return cachedMobileId;
}

/** Flip on to log raw VeSync responses to the Metro console while wiring up a real account/scale. */
export const DEBUG_LOG_RAW_RESPONSES = true;

function logDebug(label: string, data: unknown) {
  if (DEBUG_LOG_RAW_RESPONSES) {
    console.warn(`[VeSync debug] ${label}:`, JSON.stringify(data));
  }
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

/** Default fields VeSync's newer endpoints expect on every request, beyond the call-specific ones. */
function defaultFields(terminalId: string) {
  return {
    acceptLanguage: ACCEPT_LANGUAGE,
    appVersion: APP_VERSION,
    appId: APP_ID,
    clientType: CLIENT_TYPE,
    phoneBrand: PHONE_BRAND,
    phoneOS: PHONE_OS,
    mobileId: getMobileId(),
    deviceRegion: REGION,
    countryCode: REGION,
    userCountryCode: REGION,
    terminalId,
    timeZone: TIME_ZONE,
    traceId: String(Date.now()),
    userType: USER_TYPE,
    debugMode: false,
  };
}

export class VeSyncAuthError extends Error {}

/**
 * Two-step login: exchange email+password for a short-lived authorize code,
 * then exchange that code for a session token. Replaces VeSync's old
 * single-call, MD5-hashed-password `/cloud/v1/user/login` endpoint, which
 * is now deprecated and rejected server-side.
 */
export async function login(
  credentials: VeSyncCredentials,
  terminalId: string,
): Promise<VeSyncSession> {
  const authData = await postJson<{ accountID: string; authorizeCode: string }>(
    '/globalPlatform/api/accountAuth/v1/authByPWDOrOTM',
    {
      ...defaultFields(terminalId),
      email: credentials.email,
      password: credentials.password,
      method: 'authByPWDOrOTM',
    },
  );

  logDebug('authByPWDOrOTM response', authData);

  if (authData.code !== 0 || !authData.result) {
    throw new VeSyncAuthError(authData.msg ?? 'VeSync login failed');
  }

  const { authorizeCode } = authData.result;

  const loginData = await postJson<{ token: string; accountID: string }>(
    '/user/api/accountManage/v1/loginByAuthorizeCode4Vesync',
    {
      ...defaultFields(terminalId),
      method: 'loginByAuthorizeCode4Vesync',
      authorizeCode,
      emailSubscriptions: false,
    },
  );

  logDebug('loginByAuthorizeCode4Vesync response', loginData);

  if (loginData.code !== 0 || !loginData.result) {
    throw new VeSyncAuthError(loginData.msg ?? 'VeSync login failed');
  }

  return { token: loginData.result.token, accountId: loginData.result.accountID, terminalId };
}

export async function listDevices(session: VeSyncSession): Promise<VeSyncDevice[]> {
  const data = await postJson<{ list: VeSyncDevice[] }>('/cloud/v1/deviceManaged/devices', {
    ...defaultFields(session.terminalId),
    method: 'devices',
    accountID: session.accountId,
    token: session.token,
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
    ...defaultFields(session.terminalId),
    method: 'bypassV2',
    accountID: session.accountId,
    token: session.token,
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
