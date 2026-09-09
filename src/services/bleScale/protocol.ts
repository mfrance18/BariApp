/**
 * Etekcity ESN00 smart nutrition scale — BLE packet protocol.
 *
 * The ESN00 talks to its companion app over Bluetooth LE directly (not
 * through VeSync's cloud API), so this never touches VeSync's servers or the
 * cert-pinned VeSync app at all. Reverse-engineered by the community
 * (github.com/hertzg/metekcity); this is a from-scratch reimplementation of
 * just the piece BariApp needs — decoding the MEASUREMENT notification the
 * scale continuously broadcasts while a weight is on it — ported from the
 * published @metekcity/esn00-packet source (v2.0.0) and cross-checked
 * against its documented frame layout, then corrected against a real ESN00
 * (see the oz scaling note below) after an initial reading came back wrong.
 *
 * Frame layout: [4-byte header][1 type][1 length][length-byte payload][1 checksum]
 * Checksum = sum of (type + length + payload) bytes, mod 256.
 * MEASUREMENT (0xd0) payload (5 bytes): [sign][weight hi][weight lo][unit][settled]
 * The magnitude's scale factor depends on the unit: confirmed against a real
 * ESN00 as x10 for grams, but x100 for ounces (a scale reading 4.2oz sent
 * magnitude=410, not 42) — the community protocol doc only confirmed grams
 * and flagged other units as unverified, and this is the first place that
 * mattered.
 */

import { OZ_TO_G } from '../../utils/units';

export const ESN00_SERVICE_UUID = '00001910-0000-1000-8000-00805f9b34fb';
export const ESN00_NOTIFY_CHARACTERISTIC_UUID = '00002c12-0000-1000-8000-00805f9b34fb';

const FRAME_HEADER = [0xfe, 0xef, 0xc0, 0xa2];

export const Esn00PacketType = {
  MEASUREMENT: 0xd0,
} as const;

export const Esn00Unit = {
  GRAMS: 0x00,
  LB_OZ: 0x01,
  ML: 0x02,
  FL_OZ: 0x03,
  ML_MILK: 0x04,
  FL_OZ_MILK: 0x05,
  OZ: 0x06,
} as const;

export interface Esn00Frame {
  type: number;
  payload: number[];
  checksumValid: boolean;
}

/** Parses one full ESN00 frame out of raw notification bytes. Returns null if it isn't a valid ESN00 frame. */
export function parseEsn00Frame(bytes: number[]): Esn00Frame | null {
  if (bytes.length < FRAME_HEADER.length + 3) return null;
  for (let i = 0; i < FRAME_HEADER.length; i++) {
    if (bytes[i] !== FRAME_HEADER[i]) return null;
  }
  const type = bytes[4];
  const length = bytes[5];
  if (bytes.length < 6 + length + 1) return null;

  const payload = bytes.slice(6, 6 + length);
  const checksum = bytes[6 + length];
  const body = bytes.slice(4, 6 + length);
  const computed = body.reduce((sum, byte) => (sum + byte) & 0xff, 0);

  return { type, payload, checksumValid: computed === checksum };
}

export interface Esn00Measurement {
  signedValue: number;
  unit: number;
  settled: boolean;
}

/** Decodes a MEASUREMENT (0xd0) packet's payload. Returns null if the payload is too short. */
export function decodeMeasurementPayload(payload: number[]): Esn00Measurement | null {
  if (payload.length < 5) return null;
  const sign = payload[0] === 0x01 ? -1 : 1;
  const magnitude = (payload[1] << 8) | payload[2];
  return { signedValue: sign * magnitude, unit: payload[3], settled: payload[4] === 0x01 };
}

/**
 * Converts a decoded measurement to grams. Only grams (x10 scaling) and
 * ounces (x100 scaling — confirmed against a real ESN00, see the module
 * comment) are supported; any other unit mode on the scale (ml, lb+oz, ...)
 * returns null rather than guessing at an unconfirmed scale factor.
 */
export function measurementToGrams(measurement: Esn00Measurement): number | null {
  const rawValue = Math.abs(measurement.signedValue);
  if (measurement.unit === Esn00Unit.GRAMS) return rawValue / 10;
  if (measurement.unit === Esn00Unit.OZ) return (rawValue / 100) * OZ_TO_G;
  return null;
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Minimal base64 -> byte array decoder (avoids depending on Buffer/atob in the RN runtime). */
export function base64ToBytes(base64: string): number[] {
  const clean = base64.replace(/=+$/, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bitsFilled = 0;
  for (const char of clean) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bitsFilled += 6;
    if (bitsFilled >= 8) {
      bitsFilled -= 8;
      bytes.push((buffer >> bitsFilled) & 0xff);
    }
  }
  return bytes;
}

export interface WeightUpdate {
  grams: number;
  settled: boolean;
}

/**
 * Decodes a raw base64 BLE notification value into a live grams reading —
 * settling or settled — or null if it isn't a usable weight notification.
 * Used for continuous live-tracking; the caller decides what to do with an
 * unsettled reading (e.g. show it as still-fluctuating).
 */
export function decodeWeightUpdate(base64Value: string): WeightUpdate | null {
  const bytes = base64ToBytes(base64Value);
  const frame = parseEsn00Frame(bytes);
  if (!frame || !frame.checksumValid || frame.type !== Esn00PacketType.MEASUREMENT) return null;
  const measurement = decodeMeasurementPayload(frame.payload);
  if (!measurement) return null;
  const grams = measurementToGrams(measurement);
  if (grams == null) return null;
  return { grams, settled: measurement.settled };
}
