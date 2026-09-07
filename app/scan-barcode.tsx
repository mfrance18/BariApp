import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

import { mapOffProductToFood } from '../src/services/openFoodFacts/mapper';
import { getProductByBarcode } from '../src/services/openFoodFacts/client';
import { getFoodByBarcode } from '../src/db/repositories/foodsRepo';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function ScanBarcodeScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [lookingUp, setLookingUp] = useState(false);
  const handledRef = useRef(false);

  const destination = returnTo ?? '/library/food/new';

  async function handleBarcodeScanned({ data: barcode }: BarcodeScanningResult) {
    if (handledRef.current) return;
    handledRef.current = true;
    setLookingUp(true);

    const existingFood = await getFoodByBarcode(barcode);
    if (existingFood) {
      router.replace(`/library/food/${existingFood.id}`);
      return;
    }

    const product = await getProductByBarcode(barcode);

    if (!product) {
      router.replace({ pathname: destination as never, params: { barcode } });
      return;
    }

    const food = mapOffProductToFood(product, barcode);
    router.replace({
      pathname: destination as never,
      params: {
        barcode,
        name: food.name,
        brand: food.brand ?? '',
        calories: String(food.calories),
        proteinG: String(food.proteinG),
        carbsG: String(food.carbsG),
        fatG: String(food.fatG),
        fiberG: String(food.fiberG),
        sugarG: String(food.sugarG),
        sodiumMg: String(food.sodiumMg),
        source: 'open_food_facts',
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
        <Button title="Grant Camera Access" onPress={requestPermission} />
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
    padding: 24,
    gap: 12,
  },
  message: {
    textAlign: 'center',
    fontSize: 15,
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
