import { useLocalSearchParams } from 'expo-router';

import { BarcodeScanner } from '../src/components/BarcodeScanner';
import { getProductByBarcode } from '../src/services/openFoodFacts/client';
import { navigateToExistingFoodByBarcode, navigateToPrefilledFoodForm } from '../src/services/openFoodFacts/navigation';

export default function ScanBarcodeScreen() {
  const { returnTo, logMealType, logDate } = useLocalSearchParams<{
    returnTo?: string;
    logMealType?: string;
    logDate?: string;
  }>();

  const context = { destination: returnTo ?? '/food/new', logMealType, logDate, replace: true };

  async function handleScanned(barcode: string) {
    const handledExisting = await navigateToExistingFoodByBarcode(barcode, context);
    if (handledExisting) return;

    const product = await getProductByBarcode(barcode);
    navigateToPrefilledFoodForm(product, barcode, context);
  }

  return <BarcodeScanner onScanned={handleScanned} />;
}
