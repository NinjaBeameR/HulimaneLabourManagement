import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const PIN_KEY = 'hlm_app_pin';

export async function setPin(pin) {
  await SecureStore.setItemAsync(PIN_KEY, pin);
}

export async function verifyPin(pin) {
  const storedPin = await SecureStore.getItemAsync(PIN_KEY);
  return storedPin === pin;
}

export async function clearAllDataForReset() {
  await SecureStore.deleteItemAsync(PIN_KEY);
  // Add other app data clear logic here if needed
}

export async function hasPin() {
  const pin = await SecureStore.getItemAsync(PIN_KEY);
  return !!pin;
}

export async function isBiometricAvailable() {
  return await LocalAuthentication.hasHardwareAsync();
}

export async function useBiometric() {
  const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate' });
  return result.success;
}
