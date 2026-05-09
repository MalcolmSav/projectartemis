import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'artemis.pin';
const DEFAULT_PIN = '4729';

export async function getPin(): Promise<string> {
  const stored = await AsyncStorage.getItem(KEY);
  return stored ?? DEFAULT_PIN;
}

export async function setPin(next: string): Promise<void> {
  if (!/^\d{4}$/.test(next)) throw new Error('PIN must be 4 digits');
  await AsyncStorage.setItem(KEY, next);
}

export async function isDefaultPin(): Promise<boolean> {
  const cur = await AsyncStorage.getItem(KEY);
  return !cur || cur === DEFAULT_PIN;
}
