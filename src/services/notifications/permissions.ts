import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const MED_REMINDERS_CHANNEL_ID = 'med-reminders';

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(MED_REMINDERS_CHANNEL_ID, {
      name: 'Vitamin & Medication Reminders',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}
