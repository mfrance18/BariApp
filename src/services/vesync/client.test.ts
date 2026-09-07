import { findScaleDevice, normalizeWeightToKg } from './client';
import type { VeSyncDevice } from './types';

describe('findScaleDevice', () => {
  it('matches a device by deviceType containing "scale"', () => {
    const devices: VeSyncDevice[] = [
      { cid: '1', deviceName: 'Living Room Plug', deviceType: 'wifi-switch-1.3', configModule: 'x' },
      { cid: '2', deviceName: 'Bathroom Scale', deviceType: 'Wifi-Scale-1', configModule: 'y' },
    ];
    expect(findScaleDevice(devices)?.cid).toBe('2');
  });

  it('matches a device by deviceName containing "scale" when deviceType does not', () => {
    const devices: VeSyncDevice[] = [
      { cid: '1', deviceName: 'My Scale', deviceType: 'ESF-24', configModule: 'x' },
    ];
    expect(findScaleDevice(devices)?.cid).toBe('1');
  });

  it('returns null when no scale is present', () => {
    const devices: VeSyncDevice[] = [
      { cid: '1', deviceName: 'Living Room Plug', deviceType: 'wifi-switch-1.3', configModule: 'x' },
    ];
    expect(findScaleDevice(devices)).toBeNull();
  });
});

describe('normalizeWeightToKg', () => {
  it('treats large values as grams', () => {
    expect(normalizeWeightToKg(70500)).toBeCloseTo(70.5);
  });

  it('treats mid-range values as kg * 10', () => {
    expect(normalizeWeightToKg(705)).toBeCloseTo(70.5);
  });

  it('treats small values as already being kg', () => {
    expect(normalizeWeightToKg(70.5)).toBeCloseTo(70.5);
  });
});
