import { StyleSheet, Text, View } from 'react-native';

export default function ScanBarcodeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Barcode scanning coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  text: {
    fontSize: 15,
    color: '#555',
  },
});
