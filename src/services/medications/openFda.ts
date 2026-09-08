const NDC_DIRECTORY_URL = 'https://api.fda.gov/drug/ndc.json';

export interface OpenFdaProduct {
  brandName: string | null;
  genericName: string | null;
  dosageForm: string | null;
  activeIngredients: { name: string; strength: string }[];
}

interface OpenFdaNdcResult {
  brand_name?: string;
  generic_name?: string;
  dosage_form?: string;
  active_ingredients?: { name: string; strength: string }[];
}

interface OpenFdaNdcResponse {
  results?: OpenFdaNdcResult[];
}

/**
 * US retail drug barcodes (UPC-A/EAN-13) encode an 11-digit NDC plus a
 * trailing UPC check digit — EAN-13 is just that UPC-A with a leading "0".
 * The 11 digits are laid out as labeler(5)-product(4)-package(2) for
 * barcoding purposes, with a zero padded into whichever segment is
 * naturally shorter under the product's real (registered) 4-4-2 / 5-3-2 /
 * 5-4-1 configuration — and the barcode alone doesn't say which. So this
 * returns all three possible `product_ndc` (labeler-product) reconstructions
 * to try against openFDA, rather than a single definitive one.
 */
export function candidateProductNdcs(barcode: string): string[] {
  const digits = barcode.replace(/\D/g, '');
  let ndc11: string;
  if (digits.length === 13 && digits.startsWith('0')) {
    ndc11 = digits.slice(1, 12);
  } else if (digits.length === 12) {
    ndc11 = digits.slice(0, 11);
  } else {
    return [];
  }
  if (!/^\d{11}$/.test(ndc11)) return [];

  return [
    `${ndc11.slice(1, 5)}-${ndc11.slice(5, 9)}`, // 4-4 config (labeler zero-padded)
    `${ndc11.slice(0, 5)}-${ndc11.slice(6, 9)}`, // 5-3 config (product zero-padded)
    `${ndc11.slice(0, 5)}-${ndc11.slice(5, 9)}`, // 5-4 config (package zero-padded)
  ];
}

/**
 * Best-effort medication lookup by scanned barcode, via the free public
 * openFDA NDC Directory (no API key needed for this volume of use). Returns
 * null on no match, any of the 3 candidate misses, or a network/parse
 * failure — this is inherently a heuristic (see candidateProductNdcs), so a
 * miss is the expected common case, not treated as an error.
 */
export async function lookupMedicationByBarcode(barcode: string): Promise<OpenFdaProduct | null> {
  for (const candidate of candidateProductNdcs(barcode)) {
    try {
      const params = new URLSearchParams({ search: `product_ndc:"${candidate}"`, limit: '1' });
      const response = await fetch(`${NDC_DIRECTORY_URL}?${params.toString()}`);
      if (!response.ok) continue;
      const data = (await response.json()) as OpenFdaNdcResponse;
      const result = data.results?.[0];
      if (!result) continue;
      return {
        brandName: result.brand_name?.trim() || null,
        genericName: result.generic_name?.trim() || null,
        dosageForm: result.dosage_form?.trim() || null,
        activeIngredients: result.active_ingredients ?? [],
      };
    } catch {
      continue;
    }
  }
  return null;
}
