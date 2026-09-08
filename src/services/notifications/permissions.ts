import { Platform } from 'react-native';

import { isNotificationsSupported } from './environment';

export const MED_REMINDERS_CHANNEL_ID = 'med-reminders';

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNotificationsSupported) return false;

  const Notifications = await import('expo-notifications');

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
