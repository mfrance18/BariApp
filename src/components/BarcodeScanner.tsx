import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../theme/theme';
import { AppButton } from './ui/AppButton';

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

interface BarcodeScannerProps {
  /** Called with each scanned barcode. While the returned promise is pending, further scans are ignored. */
  onScanned: (barcode: string) => void | Promise<void>;
  /** Shown over the camera instead of the default prompt, e.g. "Added X" or an error. */
  statusText?: string;
}

/** Camera + corner-bracket viewfinder for barcode scanning, with permission handling. Reusable both as a full screen and inside a modal. */
export function BarcodeScanner({ onScanned, statusText }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);

  async function handleBarcodeScanned({ data: barcode }: BarcodeScanningResult) {
    if (busy) return;
    setBusy(true);
    await onScanned(barcode);
    setBusy(false);
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
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
        onBarcodeScanned={busy ? undefined : handleBarcodeScanned}
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
        {busy ? (
          <>
            <ActivityIndicator color="#fff" />
            <Text style={styles.overlayText}>Looking up product…</Text>
          </>
        ) : (
          <Text style={styles.overlayText}>{statusText ?? 'Point the camera at a barcode'}</Text>
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
    textAlign: 'center',
    maxWidth: 320,
  },
});
