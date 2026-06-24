import { createMMKV } from 'react-native-mmkv'

const storage = createMMKV({ id: 'device-identity' })
const DEVICE_ID_KEY = 'deviceId'

export function getDeviceId(): string | null {
  return storage.getString(DEVICE_ID_KEY) ?? null
}

export function saveDeviceId(id: string): void {
  storage.set(DEVICE_ID_KEY, id)
}

export function clearDeviceId(): void {
  storage.remove(DEVICE_ID_KEY)
}
