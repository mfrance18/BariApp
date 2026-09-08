import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../src/components/ui/AppButton';
import { getFoodByBarcode } from '../src/db/repositories/foodsRepo';
import { getProductByBarcode } from '../src/services/openFoodFacts/client';
import { mapOffProductToFood } from '../src/services/openFoodFacts/mapper';
import { colors, radius, spacing } from '../src/theme/theme';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function ScanBarcodeScreen() {
  const { returnTo, logMealType, logDate } = useLocalSearchParams<{
    returnTo?: string;
    logMealType?: string;
    logDate?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [lookingUp, setLookingUp] = useState(false);
  const handledRef = useRef(false);

  const destination = returnTo ?? '/library/food/new';
  const context = { logMealType, logDate };

  async function handleBarcodeScanned({ data: barcode }: BarcodeScanningResult) {
    if (handledRef.current) return;
    handledRef.current = true;
    setLookingUp(true);

    const existingFood = await getFoodByBarcode(barcode);
    if (existingFood) {
      if (logMealType) {
        router.replace({
          pathname: '/log/[mealType]/weigh',
          params: { mealType: logMealType, itemType: 'food', itemId: String(existingFood.id), logDate },
        });
      } else {
        router.replace(`/library/food/${existingFood.id}`);
      }
      return;
    }

    const product = await getProductByBarcode(barcode);

    if (!product) {
      router.replace({ pathname: destination as never, params: { barcode, ...context } });
      return;
    }

    const food = mapOffProductToFood(product, barcode);
    router.replace({
      pathname: destination as never,
      params: {
        barcode,
        name: food.name,
        brand: food.brand ?? '',
        servingAmount: String(food.servingAmount),
        servingUnit: food.servingUnit,
        calories: String(food.calories),
        proteinG: String(food.proteinG),
        carbsG: String(food.carbsG),
        fatG: String(food.fatG),
        fiberG: String(food.fiberG),
        sugarG: String(food.sugarG),
        sodiumMg: String(food.sodiumMg),
        source: 'open_food_facts',
        ...context,
      },
    });
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>BariApp needs camera access to scan barcodes.</Text>
        <AppButton title="Grant Camera Access" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={lookingUp ? undefined : handleBarcodeScanned}
      />
      <View style={styles.scanFrameContainer} pointerEvents="none">
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
      </View>
      <View style={styles.overlay}>
        {lookingUp ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>Looking up product…</Text>
          </>
        ) : (
          <Text style={styles.overlayText}>Point the camera at a barcode</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  message: {
    textAlign: 'center',
    fontSize: 15,
    color: colors.textPrimary,
  },
  scanFrameContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 170,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#fff',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  overlay: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  overlayText: {
    color: '#fff',
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
