import { StyleSheet, Text, View } from 'react-native';

export default function WeightHistoryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>No weight history yet</Text>
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
