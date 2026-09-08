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
 * below) — the older single-call `/cloud/v1/user/login` endpoint is
 * deprecated and now rejected with a misleading "app version is too low"
 * error regardless of the appVersion value sent. Each endpoint below also
 * expects its own distinct set of field names (e.g. login uses
 * `clientInfo`/`osInfo`/`clientVersion`/`appID`, while the device list and
 * bypass calls use `phoneBrand`/`phoneOS`/`appVersion`) — these are not
 * interchangeable, so each request body is built explicitly per endpoint
 * rather than from one shared "defaults" object.
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
const CLIENT_VERSION = `VeSync ${APP_VERSION}`;
const APP_ID = 'eldodkfj';
const CLIENT_TYPE = 'vesyncApp';
const PHONE_BRAND = 'BariApp';
const PHONE_OS = 'iOS';
const ACCEPT_LANGUAGE = 'en';
const REGION = 'US';
const TIME_ZONE = 'America/New_York';

let traceCounter = 0;
/** Mirrors pyvesync's DefaultValues.newTraceId() shape: not strictly validated, but matched for fidelity. */
function newTraceId(terminalId: string): string {
  traceCounter += 1;
  const suffix = terminalId.replace(/-/g, '').slice(-4);
  return `APP${suffix}${Math.floor(Date.now() / 1000)}-${String(traceCounter).padStart(5, '0')}`;
}

async function md5Hex(input: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
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

export class VeSyncAuthError extends Error {}

/**
 * Two-step login: exchange email+password for a short-lived authorize code,
 * then exchange that code for a session token. Replaces VeSync's old
 * single-call `/cloud/v1/user/login` endpoint, which is now deprecated and
 * rejected server-side. The password is still MD5-hashed (mirrors
 * `RequestGetTokenModel.__post_init__` in pyvesync), and this step's body
 * shape (`clientInfo`/`osInfo`/`clientVersion`/`appID`/`sourceAppID`) is
 * distinct from every other endpoint's fields.
 */
export async function login(
  credentials: VeSyncCredentials,
  terminalId: string,
): Promise<VeSyncSession> {
  const hashedPassword = await md5Hex(credentials.password);

  const authData = await postJson<{ accountID: string; authorizeCode: string }>(
    '/globalPlatform/api/accountAuth/v1/authByPWDOrOTM',
    {
      email: credentials.email,
      method: 'authByPWDOrOTM',
      password: hashedPassword,
      acceptLanguage: ACCEPT_LANGUAGE,
      accountID: '',
      authProtocolType: 'generic',
      clientInfo: PHONE_BRAND,
      clientType: CLIENT_TYPE,
      clientVersion: CLIENT_VERSION,
      debugMode: false,
      osInfo: PHONE_OS,
      terminalId,
      timeZone: TIME_ZONE,
      token: '',
      userCountryCode: REGION,
      appID: APP_ID,
      sourceAppID: APP_ID,
      traceId: newTraceId(terminalId),
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
      method: 'loginByAuthorizeCode4Vesync',
      authorizeCode,
      acceptLanguage: ACCEPT_LANGUAGE,
      accountID: '',
      clientInfo: PHONE_BRAND,
      clientType: CLIENT_TYPE,
      clientVersion: CLIENT_VERSION,
      debugMode: false,
      emailSubscriptions: false,
      osInfo: PHONE_OS,
      terminalId,
      timeZone: TIME_ZONE,
      token: '',
      userCountryCode: REGION,
      traceId: newTraceId(terminalId),
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
    method: 'devices',
    accountID: session.accountId,
    token: session.token,
    timeZone: TIME_ZONE,
    appVersion: APP_VERSION,
    phoneBrand: PHONE_BRAND,
    phoneOS: PHONE_OS,
    acceptLanguage: ACCEPT_LANGUAGE,
    traceId: newTraceId(session.terminalId),
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
  timestamp?: number;
  subUserID?: string | number;
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
  const rawTime = raw.time ?? raw.timestamp;
  return {
    weightKg: normalizeWeightToKg(rawWeight),
    timestamp: rawTime ? new Date(rawTime * 1000) : new Date(),
    bodyFatPct: raw.bodyFat,
    externalId:
      raw.id != null
        ? String(raw.id)
        : rawTime != null
          ? `${fallbackId}-${raw.subUserID ?? 0}-${rawTime}`
          : fallbackId,
  };
}

/**
 * VeSync's smart scale is NOT one of the device categories pyvesync
 * itself supports (confirmed against its device_map.py), so unlike
 * login/device-list there is no maintained reference implementation for
 * scale reads — the scale doesn't go through the generic bypassV2 device
 * command mechanism used by plugs/bulbs/etc at all. This is assembled from
 * two independent, unverified community reports about VeSync's fitness
 * scale line, tried in order:
 *  1. `/cloud/v2/deviceManaged/getWeighingDataV2` — a flat-body request
 *     (page/pageSize/allData/debugMode/configModule) documented in an open
 *     (unmerged) pyvesync PR adding ESF24 scale support, returning
 *     `result.weightDatas: [{ subUserID, timestamp, weightG }]`.
 *  2. `/cloud/v1/deviceManaged/fatScale/getWeighData` — referenced in a
 *     pyvesync GitHub issue by someone who packet-captured the real app
 *     talking to it for an ESF00+ scale, but no body/response shape was
 *     ever shared, so this fallback's body is a best-effort guess built
 *     from the fields every other endpoint in this file uses.
 * Check DEBUG_LOG_RAW_RESPONSES output for both if scale reads keep failing.
 */
async function fetchWeighingData(session: VeSyncSession, device: VeSyncDevice): Promise<RawScaleReading[]> {
  const v2Response = await postJson<{ weightDatas?: RawScaleReading[] }>(
    '/cloud/v2/deviceManaged/getWeighingDataV2',
    {
      method: 'getWeighingDataV2',
      accountID: session.accountId,
      token: session.token,
      configModule: device.configModule,
      timeZone: TIME_ZONE,
      appVersion: APP_VERSION,
      phoneBrand: PHONE_BRAND,
      phoneOS: PHONE_OS,
      acceptLanguage: ACCEPT_LANGUAGE,
      traceId: newTraceId(session.terminalId),
      pageSize: 100,
      page: 1,
      debugMode: false,
      allData: true,
    },
  );

  logDebug('getWeighingDataV2 response', v2Response);

  if (v2Response.code === -11201022 || v2Response.code === -11012022) {
    throw new VeSyncAuthError(v2Response.msg ?? 'VeSync session expired');
  }
  if (v2Response.code === 0 && v2Response.result?.weightDatas) {
    return v2Response.result.weightDatas;
  }

  const fatScaleResponse = await postJson<{ weightDatas?: RawScaleReading[]; items?: RawScaleReading[] }>(
    '/cloud/v1/deviceManaged/fatScale/getWeighData',
    {
      method: 'getWeighData',
      accountID: session.accountId,
      token: session.token,
      cid: device.cid,
      configModule: device.configModule,
      timeZone: TIME_ZONE,
      appVersion: APP_VERSION,
      phoneBrand: PHONE_BRAND,
      phoneOS: PHONE_OS,
      acceptLanguage: ACCEPT_LANGUAGE,
      traceId: newTraceId(session.terminalId),
    },
  );

  logDebug('fatScale/getWeighData response', fatScaleResponse);

  if (fatScaleResponse.code === -11201022 || fatScaleResponse.code === -11012022) {
    throw new VeSyncAuthError(fatScaleResponse.msg ?? 'VeSync session expired');
  }
  if (fatScaleResponse.code === 0) {
    return fatScaleResponse.result?.weightDatas ?? fatScaleResponse.result?.items ?? [];
  }

  return [];
}

export async function getLatestScaleReading(
  session: VeSyncSession,
  device: VeSyncDevice,
): Promise<WeightReading | null> {
  const readings = await getScaleWeightHistory(session, device, new Date(0));
  if (readings.length === 0) return null;
  return readings.reduce((latest, r) => (r.timestamp > latest.timestamp ? r : latest));
}

export async function getScaleWeightHistory(
  session: VeSyncSession,
  device: VeSyncDevice,
  sinceDate: Date,
): Promise<WeightReading[]> {
  const items = await fetchWeighingData(session, device);

  return items
    .map((item, index) => toWeightReading(item, `${device.cid}-${index}`))
    .filter((r): r is WeightReading => r !== null && r.timestamp >= sinceDate);
}
