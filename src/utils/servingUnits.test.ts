import { gramsPerUnit, gramsToServing, isWeighableUnit, servingToGrams } from './servingUnits';

describe('gramsPerUnit', () => {
  it('resolves common weight units case-insensitively', () => {
    expect(gramsPerUnit('g')).toBe(1);
    expect(gramsPerUnit('Grams')).toBe(1);
    expect(gramsPerUnit('KG')).toBe(1000);
    expect(gramsPerUnit('lb')).toBeCloseTo(453.592);
  });

  it('resolves oz using the same fl-oz factor used elsewhere in the app', () => {
    expect(gramsPerUnit('oz')).toBeCloseTo(29.5735);
  });

  it('returns null for a non-weight unit', () => {
    expect(gramsPerUnit('bottle')).toBeNull();
    expect(gramsPerUnit('scoop')).toBeNull();
  });
});

describe('isWeighableUnit', () => {
  it('is true for weight units and false for discrete units', () => {
    expect(isWeighableUnit('g')).toBe(true);
    expect(isWeighableUnit('bottle')).toBe(false);
  });
});

describe('servingToGrams', () => {
  it('multiplies amount by grams-per-unit for a weighable unit', () => {
    expect(servingToGrams(2, 'kg')).toBe(2000);
  });

  it('returns null for a non-weighable unit', () => {
    expect(servingToGrams(1, 'bottle')).toBeNull();
  });
});

describe('gramsToServing', () => {
  it('divides grams by grams-per-unit for a weighable unit', () => {
    expect(gramsToServing(2000, 'kg')).toBe(2);
    expect(gramsToServing(453.592, 'lb')).toBeCloseTo(1);
  });

  it('is the inverse of servingToGrams for oz', () => {
    expect(gramsToServing(servingToGrams(4, 'oz')!, 'oz')).toBeCloseTo(4);
  });

  it('returns null for a non-weighable unit', () => {
    expect(gramsToServing(100, 'bottle')).toBeNull();
  });
});
