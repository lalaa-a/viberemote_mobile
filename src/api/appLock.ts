import { createMMKV } from 'react-native-mmkv'

// Encrypted-at-rest store for the app lock. A local convenience lock — the PIN
// lives only on-device in an encrypted MMKV instance.
const lock = createMMKV({ id: 'app-lock', encryptionKey: 'vibe-remote-lock-v1' })

const K_PIN     = 'pin'
const K_ENABLED = 'enabled'
const K_BIO     = 'biometric'

export const AppLock = {
  /** Lock is active only when explicitly enabled AND a PIN exists. */
  isEnabled(): boolean {
    return (lock.getBoolean(K_ENABLED) ?? false) && !!lock.getString(K_PIN)
  },
  hasPin(): boolean {
    return !!lock.getString(K_PIN)
  },
  getPin(): string | null {
    return lock.getString(K_PIN) ?? null
  },
  setPin(pin: string): void {
    lock.set(K_PIN, pin)
    lock.set(K_ENABLED, true)
  },
  verify(pin: string): boolean {
    return lock.getString(K_PIN) === pin
  },
  disable(): void {
    lock.remove(K_PIN)
    lock.set(K_ENABLED, false)
    lock.set(K_BIO, false)
  },
  // Reserved for the biometric follow-up (needs a native rebuild).
  biometricEnabled(): boolean {
    return lock.getBoolean(K_BIO) ?? false
  },
  setBiometric(v: boolean): void {
    lock.set(K_BIO, v)
  },
}
