import { mlToOz, ozToMl } from './units';

describe('ozToMl / mlToOz', () => {
  it('converts oz to mL', () => {
    expect(ozToMl(8)).toBeCloseTo(236.588);
  });

  it('converts mL back to oz', () => {
    expect(mlToOz(236.588)).toBeCloseTo(8, 3);
  });

  it('round-trips without drift', () => {
    expect(mlToOz(ozToMl(6.5))).toBeCloseTo(6.5);
  });
});
