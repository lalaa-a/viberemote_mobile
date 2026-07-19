import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, AppState } from 'react-native'
import type { AppStateStatus } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useAppStore } from '../store/useAppStore'
import { AppLock } from '../api/appLock'
import { Biometric } from '../api/biometric'
import { PinEntry } from './PinEntry'
import { DarkColors, Spacing, Radius, FontSize, FontFamily } from '../constants/colors'

// Wraps the app. When the app lock is enabled, shows a full-screen PIN overlay
// on launch and whenever the app returns from the background. If biometrics are
// enabled, it auto-prompts and offers a manual "Use biometrics" button.
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const session = useAppStore(s => s.session)
  const insets  = useSafeAreaInsets()

  const [locked, setLocked]           = useState(() => AppLock.isEnabled())
  const [error, setError]             = useState('')
  const [resetSignal, setResetSignal] = useState(0)
  const appState     = useRef(AppState.currentState)
  const autoPrompted = useRef(false)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const prev = appState.current
      appState.current = next
      if ((next === 'background' || next === 'inactive') && AppLock.isEnabled()) {
        setLocked(true)
      }
      if (next === 'active' && prev.match(/inactive|background/) && AppLock.isEnabled()) {
        setLocked(true)
      }
    })
    return () => sub.remove()
  }, [])

  function unlock() { setError(''); setLocked(false) }

  function handleComplete(pin: string) {
    if (AppLock.verify(pin)) unlock()
    else { setError('Wrong PIN. Try again.'); setResetSignal(s => s + 1) }
  }

  async function promptBiometric() {
    const pin = await Biometric.authenticate()
    if (pin && AppLock.verify(pin)) unlock()
  }

  const showLock = !!session && locked && AppLock.isEnabled()

  // Auto-prompt biometrics once each time the lock appears.
  useEffect(() => {
    if (showLock && AppLock.biometricEnabled() && !autoPrompted.current) {
      autoPrompted.current = true
      promptBiometric()
    }
    if (!showLock) autoPrompted.current = false
  }, [showLock])

  return (
    <View style={styles.flex}>
      {children}
      {showLock && (
        <View style={[styles.overlay, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 }]}>
          <PinEntry
            title="Enter PIN"
            subtitle="Unlock Vibe Remote"
            length={4}
            error={error}
            resetSignal={resetSignal}
            onComplete={handleComplete}
          />
          {AppLock.biometricEnabled() && (
            <TouchableOpacity style={styles.bioBtn} onPress={promptBiometric} activeOpacity={0.75}>
              <Ionicons name="finger-print" size={22} color={DarkColors.online} />
              <Text style={styles.bioText}>Use biometrics</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: DarkColors.bg,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.px20,
    zIndex: 100,
  },
  bioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px8,
    marginTop: Spacing.px24, paddingHorizontal: Spacing.px20, paddingVertical: Spacing.px12,
    borderRadius: Radius.full, backgroundColor: DarkColors.surfaceRaised,
  },
  bioText: { fontSize: FontSize.body, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, fontWeight: '600' },
})
