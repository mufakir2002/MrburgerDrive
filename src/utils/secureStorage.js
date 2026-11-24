import * as SecureStore from 'expo-secure-store';

// See mr-burger-customer/src/utils/secureStorage.js for the reasoning — same
// pattern here: the JWT goes in the OS keychain/keystore, not plain AsyncStorage.

const TOKEN_KEY = 'driverToken';

export const saveToken = async (token) => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const getToken = async () => {
  return SecureStore.getItemAsync(TOKEN_KEY);
};

export const deleteToken = async () => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};
