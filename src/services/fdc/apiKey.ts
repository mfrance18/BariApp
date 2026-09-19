import * as SecureStore from 'expo-secure-store';

const API_KEY_STORE_KEY = 'fdc_api_key';

/** The user's own free USDA FoodData Central API key (api.data.gov/signup), or null if not set. */
export async function getFdcApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_STORE_KEY);
}

export async function setFdcApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_STORE_KEY, key.trim());
}

export async function clearFdcApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_STORE_KEY);
}
