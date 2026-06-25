import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, StyleSheet, View } from 'react-native';

export default function ConnectScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.center}>
        <Text>Connect</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
