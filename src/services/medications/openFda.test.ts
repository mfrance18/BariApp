import { candidateProductNdcs } from './openFda';

describe('candidateProductNdcs', () => {
  it('extracts the 3 candidate product_ndc splits from a 12-digit UPC-A', () => {
    // ndc11 = "12345678901" -> labeler(5)="12345" product(4)="6789" package(2)="01",
    // with a trailing fake UPC check digit appended to make a 12-digit UPC-A.
    expect(candidateProductNdcs('123456789015')).toEqual(['2345-6789', '12345-789', '12345-6789']);
  });

  it('extracts the same candidates from the equivalent 13-digit EAN-13 (leading 0)', () => {
    expect(candidateProductNdcs('0123456789015')).toEqual(['2345-6789', '12345-789', '12345-6789']);
  });

  it('ignores non-digit characters (e.g. a scanner reporting dashes)', () => {
    expect(candidateProductNdcs('1234-5678-9015')).toEqual(['2345-6789', '12345-789', '12345-6789']);
  });

  it('returns no candidates for a barcode of the wrong length', () => {
    expect(candidateProductNdcs('12345')).toEqual([]);
    expect(candidateProductNdcs('123456789012345')).toEqual([]);
  });

  it('returns no candidates for a 13-digit EAN-13 not starting with 0', () => {
    expect(candidateProductNdcs('1234567890123')).toEqual([]);
  });
});
