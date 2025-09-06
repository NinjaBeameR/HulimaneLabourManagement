import AsyncStorage from "@react-native-async-storage/async-storage";
const PREFIX = "@hlm:";

export const setItem = async (key, value) => {
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
};

export const getItem = async (key, defaultValue = null) => {
  const v = await AsyncStorage.getItem(PREFIX + key);
  return v ? JSON.parse(v) : defaultValue;
};

export const removeItem = async (key) => {
  await AsyncStorage.removeItem(PREFIX + key);
};
