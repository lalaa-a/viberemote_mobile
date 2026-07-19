import * as Keychain from 'react-native-keychain'

// Keychain entry that holds the app-lock PIN behind a biometric access control.
// Retrieving it triggers the OS fingerprint / Face prompt.
const SERVICE = 'com.viberemote.applock.bio'

export const Biometric = {
  /** Returns 'FaceID' | 'TouchID' | 'Fingerprint' | 'Face' | 'Iris' | null. */
  async supportedType(): Promise<string | null> {
    try {
      return await Keychain.getSupportedBiometryType()
    } catch {
      return null
    }
  },

  /** Store the PIN gated behind the device's current biometric set. */
  async enable(pin: string): Promise<boolean> {
    try {
      await Keychain.setGenericPassword('applock', pin, {
        service:        SERVICE,
        accessControl:  Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
        accessible:     Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      })
      return true
    } catch {
      return false
    }
  },

  async disable(): Promise<void> {
    try { await Keychain.resetGenericPassword({ service: SERVICE }) } catch {}
  },

  /** Prompt biometrics; resolves to the stored PIN on success, else null. */
  async authenticate(): Promise<string | null> {
    try {
      const creds = await Keychain.getGenericPassword({
        service:              SERVICE,
        authenticationPrompt: { title: 'Unlock Vibe Remote' },
      })
      return creds ? creds.password : null
    } catch {
      return null
    }
  },
}
