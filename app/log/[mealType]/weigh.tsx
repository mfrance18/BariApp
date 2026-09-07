import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function WeighScreen() {
  const { mealType } = useLocalSearchParams<{ mealType: string }>();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Weigh item for {mealType}</Text>
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
