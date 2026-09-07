import { StyleSheet, Text, View } from 'react-native';

export default function MedsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Today&apos;s Vitamins &amp; Meds</Text>
      <Text style={styles.emptyText}>Nothing scheduled yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    color: '#888',
  },
});
