import { isRunningInExpoGo } from 'expo';

/**
 * expo-notifications throws as a side effect of its own module
 * initialization when imported in Expo Go on Android (push-token
 * auto-registration was removed from Expo Go in SDK 53+, and the package
 * unconditionally tries to register a listener for it at import time). To
 * keep the rest of the app usable in Expo Go for quick testing, this module
 * must not be imported at all in that environment — reminders simply
 * require a development or production build instead.
 */
export const isNotificationsSupported = !isRunningInExpoGo();
