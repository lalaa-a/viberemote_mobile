import React, { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { DarkColors, Spacing, Radius, FontSize, FontFamily } from '../constants/colors'

interface Props {
  title:       string
  subtitle?:   string
  length?:     number
  error?:      string
  /** bump this number to clear the entered digits (e.g. after a wrong PIN) */
  resetSignal?: number
  onComplete:  (pin: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back']

// Reusable numeric PIN entry (dots + keypad). Used for both setting and
// unlocking the app lock.
export function PinEntry({ title, subtitle, length = 4, error, resetSignal = 0, onComplete }: Props) {
  const [value, setValue] = useState('')

  useEffect(() => { setValue('') }, [resetSignal])

  useEffect(() => {
    if (value.length === length) {
      const pin = value
      const t = setTimeout(() => onComplete(pin), 120) // let the last dot paint
      return () => clearTimeout(t)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  function press(k: string) {
    if (k === 'back') { setValue(v => v.slice(0, -1)); return }
    if (k === '') return
    setValue(v => (v.length < length ? v + k : v))
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.dots}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < value.length && styles.dotFilled, !!error && styles.dotError]}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorSpacer} />}

      <View style={styles.pad}>
        {KEYS.map((k, i) => (
          <TouchableOpacity
            key={i}
            style={styles.key}
            onPress={() => press(k)}
            activeOpacity={k ? 0.6 : 1}
            disabled={!k}
          >
            {k === 'back'
              ? <Ionicons name="backspace-outline" size={26} color={DarkColors.textPrimary} />
              : <Text style={styles.keyText}>{k}</Text>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:     { alignItems: 'center', gap: Spacing.px8 },
  title:    { fontSize: FontSize.displayM, fontWeight: '600', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans },
  subtitle: { fontSize: FontSize.body, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans, textAlign: 'center' },

  dots:      { flexDirection: 'row', gap: Spacing.px16, marginTop: Spacing.px20 },
  dot:       { width: 16, height: 16, borderRadius: Radius.full, borderWidth: 1.5, borderColor: DarkColors.textTertiary },
  dotFilled: { backgroundColor: DarkColors.online, borderColor: DarkColors.online },
  dotError:  { borderColor: DarkColors.danger },
  error:       { fontSize: FontSize.label, color: DarkColors.danger, height: 18, fontFamily: FontFamily.googleSans },
  errorSpacer: { height: 18 },

  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 300, marginTop: Spacing.px12 },
  key: { width: '33.33%', height: 68, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 28, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, fontWeight: '500' },
})
