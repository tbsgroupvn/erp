/**
 * Wrapper cho AsyncStorage — type-safe key-value store
 * Dung cho luu token, user info, offline queue
 *
 * SECURITY WARNING (production):
 * AsyncStorage khong duoc ma hoa tren Android va iOS.
 * Doi voi du lieu nhay cam (access token, refresh token):
 *
 * TODO: Thay the AsyncStorage bang react-native-keychain cho token storage
 *   - iOS: du lieu duoc bao ve boi Secure Enclave / Keychain
 *   - Android: du lieu duoc bao ve boi EncryptedSharedPreferences / Keystore
 *   - Cai dat: yarn add react-native-keychain
 *   - Huong dan: https://github.com/oblador/react-native-keychain
 *
 * Hien tai AsyncStorage chi duoc chap nhan cho:
 *   - OFFLINE_QUEUE (khong chua thong tin nhay cam)
 *   - TOKEN_EXPIRY (chi la timestamp, khong co gia tri bi mat)
 *
 * Keys ACCESS_TOKEN, REFRESH_TOKEN, USER_INFO nen duoc chuyen sang Keychain.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Key constants de tranh loi chinh ta
export const STORAGE_KEYS = {
  ACCESS_TOKEN: '@tbs:access_token',
  REFRESH_TOKEN: '@tbs:refresh_token',
  USER_INFO: '@tbs:user_info',
  OFFLINE_QUEUE: '@tbs:offline_queue',
  TOKEN_EXPIRY: '@tbs:token_expiry',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Luu gia tri string vao AsyncStorage
 * Tra ve false neu loi
 */
export async function setItem(key: StorageKey, value: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Doc gia tri tu AsyncStorage
 * Tra ve null neu khong co hoac loi
 */
export async function getItem(key: StorageKey): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Xoa mot key khoi AsyncStorage
 */
export async function removeItem(key: StorageKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Luu object duoi dang JSON
 */
export async function setObject<T>(key: StorageKey, value: T): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Doc va parse JSON tu AsyncStorage
 * Tra ve null neu khong co hoac parse loi
 */
export async function getObject<T>(key: StorageKey): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    // FIX: Boc trong try/catch rieng de phan biet loi storage vs loi parse
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Du lieu bi hong — xoa luon de tranh lap lai loi
      await AsyncStorage.removeItem(key).catch(() => undefined);
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Xoa toan bo token va session data
 * Goi khi logout
 */
export async function clearSession(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.ACCESS_TOKEN,
    STORAGE_KEYS.REFRESH_TOKEN,
    STORAGE_KEYS.USER_INFO,
    STORAGE_KEYS.TOKEN_EXPIRY,
  ]);
}
