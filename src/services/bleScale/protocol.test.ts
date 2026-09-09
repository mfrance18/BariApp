import {
  base64ToBytes,
  decodeMeasurementPayload,
  decodeWeightNotification,
  describeFrame,
  Esn00PacketType,
  Esn00Unit,
  measurementToGrams,
  parseEsn00Frame,
} from './protocol';

function checksum(bytes: number[]): number {
  return bytes.reduce((sum, byte) => (sum + byte) & 0xff, 0);
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: number[]): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = bytes.slice(i, i + 3);
    const b0 = chunk[0];
    const b1 = chunk[1];
    const b2 = chunk[2];
    result += BASE64_ALPHABET[b0 >> 2];
    result += BASE64_ALPHABET[((b0 & 0x03) << 4) | (b1 === undefined ? 0 : b1 >> 4)];
    result += b1 === undefined ? '=' : BASE64_ALPHABET[((b1 & 0x0f) << 2) | (b2 === undefined ? 0 : b2 >> 6)];
    result += b2 === undefined ? '=' : BASE64_ALPHABET[b2 & 0x3f];
  }
  return result;
}

function buildMeasurementFrame(payload: number[]): number[] {
  const body = [Esn00PacketType.MEASUREMENT, payload.length, ...payload];
  return [0xfe, 0xef, 0xc0, 0xa2, ...body, checksum(body)];
}

const SETTLED_235_5G = [0x00, 0x09, 0x33, Esn00Unit.GRAMS, 0x01];

describe('parseEsn00Frame', () => {
  it('parses a valid frame and validates the checksum', () => {
    const frame = parseEsn00Frame(buildMeasurementFrame(SETTLED_235_5G));
    expect(frame).toEqual({
      type: Esn00PacketType.MEASUREMENT,
      payload: SETTLED_235_5G,
      checksumValid: true,
    });
  });

  it('flags a corrupted checksum instead of throwing', () => {
    const bytes = buildMeasurementFrame(SETTLED_235_5G);
    bytes[bytes.length - 1] ^= 0xff;
    expect(parseEsn00Frame(bytes)?.checksumValid).toBe(false);
  });

  it('returns null for bytes that do not start with the ESN00 header', () => {
    expect(parseEsn00Frame([0x00, 0x00, 0x00, 0x00, 0xd0, 0x00, 0x00])).toBeNull();
  });

  it('returns null for a truncated frame', () => {
    expect(parseEsn00Frame([0xfe, 0xef, 0xc0, 0xa2, 0xd0, 0x05, 0x00])).toBeNull();
  });
});

describe('decodeMeasurementPayload', () => {
  it('decodes sign, weight, unit and settled flag', () => {
    expect(decodeMeasurementPayload(SETTLED_235_5G)).toEqual({
      signedValue: 2355,
      unit: Esn00Unit.GRAMS,
      settled: true,
    });
  });

  it('decodes a negative sign', () => {
    expect(decodeMeasurementPayload([0x01, 0x00, 0x0a, Esn00Unit.GRAMS, 0x00])?.signedValue).toBe(-10);
  });

  it('returns null for a too-short payload', () => {
    expect(decodeMeasurementPayload([0x00, 0x00])).toBeNull();
  });
});

describe('measurementToGrams', () => {
  it('divides the raw value by 10 for grams', () => {
    expect(measurementToGrams({ signedValue: 2355, unit: Esn00Unit.GRAMS, settled: true })).toBeCloseTo(235.5);
  });

  it('converts ounces to grams', () => {
    expect(measurementToGrams({ signedValue: 100, unit: Esn00Unit.OZ, settled: true })).toBeCloseTo(283.49523125);
  });

  it('returns null for units other than grams/ounces', () => {
    expect(measurementToGrams({ signedValue: 100, unit: Esn00Unit.ML, settled: true })).toBeNull();
  });
});

describe('base64ToBytes', () => {
  it('round-trips a byte sequence encoded with an independent base64 encoder', () => {
    const bytes = buildMeasurementFrame(SETTLED_235_5G);
    const base64 = bytesToBase64(bytes);
    expect(base64ToBytes(base64)).toEqual(bytes);
  });
});

describe('decodeWeightNotification', () => {
  it('decodes a settled grams reading end-to-end from a base64 notification value', () => {
    const base64 = bytesToBase64(buildMeasurementFrame(SETTLED_235_5G));
    expect(decodeWeightNotification(base64)).toBeCloseTo(235.5);
  });

  it('returns null while the reading is still settling', () => {
    const unsettled = [0x00, 0x09, 0x33, Esn00Unit.GRAMS, 0x00];
    const base64 = bytesToBase64(buildMeasurementFrame(unsettled));
    expect(decodeWeightNotification(base64)).toBeNull();
  });

  it('returns null for a non-MEASUREMENT packet type', () => {
    const body = [0xd1, 1, 0x00];
    const bytes = [0xfe, 0xef, 0xc0, 0xa2, ...body, checksum(body)];
    expect(decodeWeightNotification(bytesToBase64(bytes))).toBeNull();
  });

  it('returns null for a bad checksum', () => {
    const bytes = buildMeasurementFrame(SETTLED_235_5G);
    bytes[bytes.length - 1] ^= 0xff;
    expect(decodeWeightNotification(bytesToBase64(bytes))).toBeNull();
  });
});

describe('describeFrame', () => {
  it('summarizes a decoded measurement frame', () => {
    const base64 = bytesToBase64(buildMeasurementFrame(SETTLED_235_5G));
    const summary = describeFrame(base64);
    expect(summary).toContain('type=0xd0');
    expect(summary).toContain('unit=0x0');
    expect(summary).toContain('settled=true');
    expect(summary).toContain('grams=235.5');
  });

  it('still summarizes an unparseable frame instead of throwing', () => {
    const summary = describeFrame(bytesToBase64([0x00, 0x01, 0x02]));
    expect(summary).toContain('unparsed');
  });
});
