import {
  gramsPerUnit,
  gramsToServing,
  isWeighableUnit,
  ozPerUsVolumeUnit,
  parseServingAmount,
  servingToGrams,
} from './servingUnits';

describe('gramsPerUnit', () => {
  it('resolves common weight units case-insensitively', () => {
    expect(gramsPerUnit('g')).toBe(1);
    expect(gramsPerUnit('Grams')).toBe(1);
    expect(gramsPerUnit('KG')).toBe(1000);
    expect(gramsPerUnit('lb')).toBeCloseTo(453.592);
  });

  it('resolves oz using the mass ounce, not the fluid ounce used for fluid intake', () => {
    expect(gramsPerUnit('oz')).toBeCloseTo(28.349523125);
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

describe('ozPerUsVolumeUnit', () => {
  it('treats a cup as 8 (mass) oz, the household kitchen approximation', () => {
    expect(ozPerUsVolumeUnit('cup')).toBe(8);
  });

  it('resolves tbsp/tsp/fl oz/pint/quart/gallon consistently with the cup', () => {
    expect(ozPerUsVolumeUnit('tbsp')).toBe(0.5);
    expect(ozPerUsVolumeUnit('tsp')).toBeCloseTo(1 / 6);
    expect(ozPerUsVolumeUnit('fl oz')).toBe(1);
    expect(ozPerUsVolumeUnit('pint')).toBe(16);
    expect(ozPerUsVolumeUnit('quart')).toBe(32);
    expect(ozPerUsVolumeUnit('gallon')).toBe(128);
  });

  it('is case-insensitive and returns null for a non-US-volume unit', () => {
    expect(ozPerUsVolumeUnit('Tablespoons')).toBe(0.5);
    expect(ozPerUsVolumeUnit('g')).toBeNull();
    expect(ozPerUsVolumeUnit('bottle')).toBeNull();
  });

  it('is deliberately not part of isWeighableUnit — see the module comment', () => {
    expect(isWeighableUnit('cup')).toBe(false);
  });
});

describe('parseServingAmount', () => {
  it('parses plain decimals', () => {
    expect(parseServingAmount('2')).toBe(2);
    expect(parseServingAmount('1.5')).toBe(1.5);
  });

  it('parses a simple fraction', () => {
    expect(parseServingAmount('1/4')).toBeCloseTo(0.25);
    expect(parseServingAmount('3/4')).toBeCloseTo(0.75);
  });

  it('parses a mixed number', () => {
    expect(parseServingAmount('1 1/2')).toBeCloseTo(1.5);
    expect(parseServingAmount('2 1/3')).toBeCloseTo(2 + 1 / 3);
  });

  it('returns null for empty input or a zero denominator', () => {
    expect(parseServingAmount('')).toBeNull();
    expect(parseServingAmount('  ')).toBeNull();
    expect(parseServingAmount('1/0')).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(parseServingAmount('abc')).toBeNull();
  });
});
