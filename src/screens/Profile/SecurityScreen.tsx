import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, TextInput, Switch,
} from 'react-native'
import { useMutation } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { changePassword } from '../../api/server'
import { AppLock } from '../../api/appLock'
import { Biometric } from '../../api/biometric'
import { GradientBackground } from '../../components/GradientBackground'
import { BackButton } from '../../components/ui/BackButton'
import { PinEntry } from '../../components/PinEntry'
import { DarkColors, Spacing, Radius, FontSize, FontFamily, TAB_BOTTOM_INSET } from '../../constants/colors'

type Flow = null | 'set' | 'confirm'

// Icons match the bottom-nav style: a plain monochrome white stroke, no per-row accent
// colour and no tinted chip. `tint` is accepted but intentionally ignored so call sites keep working.
function Row({ icon, label, sub, right, onPress, last, disabled }: {
  icon: string; tint?: string; label: string; sub?: string
  right?: React.ReactNode; onPress?: () => void; last?: boolean; disabled?: boolean
}) {
  const content = (
    <>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={24} color={DarkColors.tabActive} />
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={DarkColors.textTertiary} /> : null)}
    </>
  )
  const style = [styles.row, !last && styles.rowBorder, disabled && { opacity: 0.5 }]

  // A row with a Switch (no onPress) must be a plain View so the Switch stays tappable.
  if (!onPress) return <View style={style}>{content}</View>
  return (
    <TouchableOpacity style={style} onPress={onPress} disabled={disabled} activeOpacity={0.7}>
      {content}
    </TouchableOpacity>
  )
}

export function SecurityScreen() {
  const insets = useSafeAreaInsets()

  const [enabled,     setEnabled]     = useState(AppLock.isEnabled())
  const [flow,        setFlow]        = useState<Flow>(null)
  const [firstPin,    setFirstPin]    = useState('')
  const [error,       setError]       = useState('')
  const [resetSignal, setResetSignal] = useState(0)

  const [showPwd, setShowPwd] = useState(false)
  const [newPwd,  setNewPwd]  = useState('')

  const [bioType, setBioType]     = useState<string | null>(null)
  const [bioOn,   setBioOn]       = useState(AppLock.biometricEnabled())

  useEffect(() => { Biometric.supportedType().then(setBioType) }, [])

  const bioLabel = bioType === 'FaceID' || bioType === 'Face' ? 'Face unlock'
    : bioType === 'TouchID' ? 'Touch ID'
    : bioType ? 'Fingerprint unlock'
    : 'Biometric unlock'

  async function toggleBiometric(v: boolean) {
    if (v) {
      const pin = AppLock.getPin()
      if (!enabled || !pin) { Alert.alert('Set a PIN first', 'Turn on App lock and set a PIN before enabling biometrics.'); return }
      if (!bioType) { Alert.alert('Not available', 'No biometrics are enrolled on this device.'); return }
      const ok = await Biometric.enable(pin)
      if (ok) { AppLock.setBiometric(true); setBioOn(true) }
      else Alert.alert('Could not enable', 'Biometric setup was cancelled or failed.')
    } else {
      await Biometric.disable()
      AppLock.setBiometric(false); setBioOn(false)
    }
  }

  const pwdMut = useMutation({
    mutationFn: (pwd: string) => changePassword(pwd),
    onSuccess:  () => { setNewPwd(''); setShowPwd(false); Alert.alert('Password changed', 'Your account password has been updated.') },
    onError:    (e: any) => Alert.alert('Error', e.message),
  })

  function startSetPin() {
    setFirstPin(''); setError(''); setResetSignal(s => s + 1); setFlow('set')
  }

  function onPinComplete(pin: string) {
    if (flow === 'set') {
      setFirstPin(pin); setError(''); setResetSignal(s => s + 1); setFlow('confirm')
    } else if (flow === 'confirm') {
      if (pin === firstPin) {
        AppLock.setPin(pin)
        // Keep the biometric-stored PIN in sync if biometrics are on.
        if (bioOn) Biometric.enable(pin)
        setEnabled(true); setFlow(null)
        Alert.alert('App lock enabled', 'You’ll be asked for this PIN when opening Vibe Remote.')
      } else {
        setError('PINs didn’t match. Start again.')
        setFirstPin(''); setResetSignal(s => s + 1); setFlow('set')
      }
    }
  }

  function toggleLock(v: boolean) {
    if (v) {
      startSetPin()
    } else {
      Alert.alert('Turn off app lock?', 'Your PIN and biometric unlock will be removed.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn Off', style: 'destructive', onPress: async () => { await Biometric.disable(); AppLock.disable(); setEnabled(false); setBioOn(false) } },
      ])
    }
  }

  // ── PIN entry flow (full-screen) ──
  if (flow) {
    return (
      <GradientBackground style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <BackButton onPress={() => { setFlow(null); setError('') }} />
          <Text style={styles.headerTitle}>{flow === 'set' ? 'Set PIN' : 'Confirm PIN'}</Text>
        </View>
        <View style={styles.flowBody}>
          <PinEntry
            title={flow === 'set' ? 'Choose a PIN' : 'Re-enter PIN'}
            subtitle={flow === 'set' ? 'You’ll use this to unlock the app' : 'Confirm your new PIN'}
            length={4}
            error={error}
            resetSignal={resetSignal}
            onComplete={onPinComplete}
          />
        </View>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <BackButton />
        <Text style={styles.headerTitle}>Security & Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: TAB_BOTTOM_INSET }]} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionLabel}>APP LOCK</Text>
        <View style={styles.group}>
          <Row
            icon="lock-closed-outline" tint={DarkColors.online}
            label="App lock"
            sub={enabled ? 'On — PIN required to open the app' : 'Require a PIN to open the app'}
            right={
              <Switch
                value={enabled}
                onValueChange={toggleLock}
                trackColor={{ false: DarkColors.surfaceRaised, true: DarkColors.online }}
                thumbColor="#FFFFFF"
              />
            }
            last={!enabled}
          />
          {enabled && (
            <Row icon="keypad-outline" tint={DarkColors.badgeBg} label="Change PIN" onPress={startSetPin} last />
          )}
        </View>

        <View style={styles.group}>
          <Row
            icon="finger-print-outline" tint="#B79CE6"
            label={bioLabel}
            sub={!enabled ? 'Set a PIN first' : !bioType ? 'Not available on this device' : bioOn ? 'On' : 'Unlock with biometrics'}
            right={
              <Switch
                value={bioOn}
                onValueChange={toggleBiometric}
                disabled={!enabled || !bioType}
                trackColor={{ false: DarkColors.surfaceRaised, true: DarkColors.online }}
                thumbColor="#FFFFFF"
              />
            }
            last
          />
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.group}>
          <Row
            icon="key-outline" tint={DarkColors.unpair}
            label="Change account password"
            onPress={() => setShowPwd(v => !v)}
            last
          />
        </View>

        {showPwd && (
          <View style={styles.pwdCard}>
            <TextInput
              style={styles.pwdInput}
              value={newPwd}
              onChangeText={setNewPwd}
              placeholder="New password (min 6 chars)"
              placeholderTextColor={DarkColors.textTertiary}
              secureTextEntry
              autoFocus
            />
            <TouchableOpacity
              onPress={() => newPwd.length >= 6 && pwdMut.mutate(newPwd)}
              disabled={pwdMut.isPending || newPwd.length < 6}
              style={[styles.saveBtn, (newPwd.length < 6 || pwdMut.isPending) && { opacity: 0.5 }]}
            >
              {pwdMut.isPending
                ? <ActivityIndicator size="small" color={DarkColors.bg} />
                : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  root:   { backgroundColor: DarkColors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px12, paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px12 },
  headerTitle: { fontSize: FontSize.cardTitle, fontWeight: '700', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans },
  flowBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },

  list: { paddingHorizontal: Spacing.px20, paddingTop: Spacing.px4, gap: Spacing.px10 },
  sectionLabel: {
    fontSize: FontSize.microLabel, fontWeight: '700', color: DarkColors.textTertiary,
    letterSpacing: 0.6, marginTop: Spacing.px8, marginBottom: Spacing.px2, paddingHorizontal: Spacing.px4,
  },
  group: { backgroundColor: DarkColors.surface, borderRadius: Radius.lg, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px12, paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px10, minHeight: 58 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: DarkColors.border },
  rowIcon: { width: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowMid:   { flex: 1, gap: 2 },
  rowLabel: { fontSize: FontSize.body, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, fontWeight: '500' },
  rowSub:   { fontSize: FontSize.metadata, color: DarkColors.textTertiary, fontFamily: FontFamily.googleSans },

  pwdCard: { backgroundColor: DarkColors.surface, borderRadius: Radius.lg, padding: Spacing.px16, flexDirection: 'row', gap: Spacing.px8, alignItems: 'center', marginTop: -Spacing.px4 },
  pwdInput: {
    flex: 1, height: 44, borderRadius: Radius.sm, backgroundColor: DarkColors.surfaceRaised,
    borderWidth: 1, borderColor: DarkColors.borderMid,
    paddingHorizontal: Spacing.px12, fontSize: FontSize.body, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans,
  },
  saveBtn: { paddingHorizontal: Spacing.px16, height: 44, borderRadius: Radius.full, backgroundColor: DarkColors.online, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: FontSize.label, fontWeight: '700', color: DarkColors.bg, fontFamily: FontFamily.googleSans },
})
