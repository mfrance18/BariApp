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
 * against its documented frame layout. Still worth confirming against the
 * real scale: flip DEBUG_LOG_RAW_PACKETS in client.ts if a reading looks
 * wrong.
 *
 * Frame layout: [4-byte header][1 type][1 length][length-byte payload][1 checksum]
 * Checksum = sum of (type + length + payload) bytes, mod 256.
 * MEASUREMENT (0xd0) payload (5 bytes): [sign][weight hi][weight lo][unit][settled]
 * Weight is the magnitude x10 (grams confirmed; other units unconfirmed).
 */

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

const OZ_TO_G = 28.349523125;

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
 * Converts a decoded measurement to grams. Only grams and ounces are
 * confirmed to use the x10 scaling the protocol documents, so any other
 * unit mode on the scale (ml, lb+oz, ...) returns null rather than guessing.
 */
export function measurementToGrams(measurement: Esn00Measurement): number | null {
  const magnitude = Math.abs(measurement.signedValue) / 10;
  if (measurement.unit === Esn00Unit.GRAMS) return magnitude;
  if (measurement.unit === Esn00Unit.OZ) return magnitude * OZ_TO_G;
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

/** Decodes a raw base64 BLE notification value into a grams reading, or null if it isn't a usable settled weight. */
export function decodeWeightNotification(base64Value: string): number | null {
  const bytes = base64ToBytes(base64Value);
  const frame = parseEsn00Frame(bytes);
  if (!frame || !frame.checksumValid || frame.type !== Esn00PacketType.MEASUREMENT) return null;
  const measurement = decodeMeasurementPayload(frame.payload);
  if (!measurement || !measurement.settled) return null;
  return measurementToGrams(measurement);
}

/**
 * Human-readable one-line summary of a raw notification, for diagnosing a
 * real scale's actual byte layout against what this protocol module
 * assumes — temporary tooling until the ESN00 protocol is fully confirmed.
 */
export function describeFrame(base64Value: string): string {
  const bytes = base64ToBytes(base64Value);
  const frame = parseEsn00Frame(bytes);
  if (!frame) return `unparsed bytes=[${bytes.join(',')}]`;

  const typeHex = `0x${frame.type.toString(16).padStart(2, '0')}`;
  const payloadHex = frame.payload.map((b) => b.toString(16).padStart(2, '0')).join(' ');
  let summary = `type=${typeHex} len=${frame.payload.length} payload=[${payloadHex}] checksumValid=${frame.checksumValid}`;

  if (frame.type === Esn00PacketType.MEASUREMENT) {
    const measurement = decodeMeasurementPayload(frame.payload);
    if (measurement) {
      const grams = measurementToGrams(measurement);
      summary += ` | signedValue=${measurement.signedValue} unit=0x${measurement.unit.toString(16)} settled=${measurement.settled} grams=${grams}`;
    }
  }
  return summary;
}
