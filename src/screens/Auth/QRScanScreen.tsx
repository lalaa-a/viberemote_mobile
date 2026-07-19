import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar, Animated, Platform,
} from 'react-native'
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera'
import { useNavigation } from '@react-navigation/native'
import { pairMachine } from '../../api/server'
import { getDeviceId } from '../../api/device'
import { useAppStore } from '../../store/useAppStore'
import { GradientBackground } from '../../components/GradientBackground'
import { DarkColors, Spacing, Radius, FontSize, FontFamily } from '../../constants/colors'
import LogoIcon from '../../assets/icons/chats.svg'
import type { QRPayload } from '../../types'

const FRAME  = 240
const CORNER = 28
const BORDER = 3

function ScanBrackets({ state }: { state: 'idle' | 'success' | 'error' }) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (state !== 'idle') {
      Animated.spring(scale, { toValue: 1.08, useNativeDriver: true, tension: 80, friction: 5 }).start()
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.03, duration: 1500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.00, duration: 1500, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [state])

  const color = state === 'success' ? DarkColors.online : state === 'error' ? DarkColors.danger : DarkColors.online

  return (
    <Animated.View style={[styles.frame, { transform: [{ scale }] }]}>
      <View style={[styles.corner, styles.tl, { borderColor: color }]} />
      <View style={[styles.corner, styles.tr, { borderColor: color }]} />
      <View style={[styles.corner, styles.bl, { borderColor: color }]} />
      <View style={[styles.corner, styles.br, { borderColor: color }]} />
    </Animated.View>
  )
}

export function QRScanScreen() {
  const navigation  = useNavigation()
  const showToast   = useAppStore(s => s.showToast)
  const { hasPermission, requestPermission } = useCameraPermission()
  const device = useCameraDevice('back')

  const [loading,   setLoading]   = useState(false)
  const [scanState, setScanState] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('Scan the QR on a machine dashboard to connect it.')
  const isProcessing = useRef(false)

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (isProcessing.current) return

      const raw = codes[0]?.value
      if (!raw) return

      let payload: QRPayload
      try { payload = JSON.parse(raw) } catch { return }
      if (!payload.machineId || !payload.apiKey || !payload.challenge) return

      const deviceId = getDeviceId()
      if (!deviceId) {
        setStatusMsg('Device not registered yet — please restart the app.')
        return
      }

      isProcessing.current = true
      setLoading(true)
      setStatusMsg('Connecting…')

      pairMachine(payload.machineId, payload.apiKey, deviceId, payload.challenge)
        .then(result => {
          if (result.alreadyPaired) {
            setScanState('success')
            setStatusMsg('Already connected to this phone.')
            showToast('Already connected to this phone.', 'success')
          } else {
            setScanState('success')
            setStatusMsg('Connected!')
            showToast('Machine connected!', 'success')
          }
          setTimeout(() => navigation.goBack(), 1200)
        })
        .catch((err: any) => {
          setScanState('error')
          if (err.code === 'paired_elsewhere') {
            Alert.alert(
              'Already connected',
              'This machine is connected to another phone. Ask the other phone to disconnect first.',
              [{ text: 'OK', onPress: reset }]
            )
          } else if (err.code === 'bad_challenge') {
            Alert.alert(
              'QR code expired',
              'This QR code has expired or was already used. Refresh it on the desktop and scan again.',
              [{ text: 'OK', onPress: reset }]
            )
          } else if (err.code === 'owned_elsewhere') {
            Alert.alert(
              'Owned by another account',
              'This machine is already owned by a different account. Unpair it from that account first.',
              [{ text: 'OK', onPress: reset }]
            )
          } else {
            Alert.alert('Connection failed', err.message ?? 'Could not pair machine.', [{ text: 'Try again', onPress: reset }])
          }
        })
    },
  })

  function reset() {
    isProcessing.current = false
    setLoading(false)
    setScanState('idle')
    setStatusMsg('Scan the QR on a machine dashboard to connect it.')
  }

  if (!hasPermission) {
    return (
      <GradientBackground style={styles.bg}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.permCenter}>
          <View style={styles.logoBox}>
            <LogoIcon width={32} height={32} color={DarkColors.online} />
          </View>
          <Text style={styles.permTitle}>Camera access needed</Text>
          <Text style={styles.permSub}>
            Point your camera at the QR code on the machine dashboard to connect it.
          </Text>
          <TouchableOpacity style={styles.inkBtn} onPress={requestPermission} activeOpacity={0.85}>
            <Text style={styles.inkBtnText}>Grant camera access</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.permCancel} activeOpacity={0.7}>
            <Text style={styles.permCancelText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </GradientBackground>
    )
  }

  if (!device) {
    return (
      <GradientBackground style={styles.bg}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <View style={styles.permCenter}>
          <View style={styles.logoBox}>
            <LogoIcon width={32} height={32} color={DarkColors.online} />
          </View>
          <Text style={styles.permTitle}>No camera found</Text>
          <Text style={styles.permSub}>This device doesn’t have a usable camera to scan the QR code.</Text>
          <TouchableOpacity style={styles.inkBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.inkBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </GradientBackground>
    )
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!loading}
        codeScanner={codeScanner}
      />

      <View style={styles.overlay}>
        <View style={styles.topSection}>
          <View style={styles.logoBox}>
            <LogoIcon width={32} height={32} color={DarkColors.online} />
          </View>
          <Text style={styles.cameraTitle}>Connect Machine</Text>
          <Text style={styles.cameraSubtitle}>
            Scan the QR code on the desktop app dashboard.
          </Text>
        </View>

        <View style={styles.frameWrap}>
          <ScanBrackets state={scanState} />
          {loading && (
            <View style={styles.spinnerWrap}>
              <ActivityIndicator size="large" color={DarkColors.online} />
            </View>
          )}
        </View>

        <View style={styles.bottomSection}>
          <View style={[
            styles.statusPill,
            scanState === 'success' && styles.statusPillSuccess,
            scanState === 'error'   && styles.statusPillError,
          ]}>
            <Text style={[
              styles.statusText,
              scanState === 'success' && { color: DarkColors.online },
              scanState === 'error'   && { color: DarkColors.danger },
            ]}>
              {statusMsg}
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bg:   { backgroundColor: DarkColors.bg },
  root: { flex: 1, backgroundColor: '#000' },
  permCenter: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.px32, paddingTop: Spacing.px56, gap: Spacing.px16,
  },
  logoBox: {
    width: 60, height: 60, borderRadius: Radius.lg,
    backgroundColor: DarkColors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.px8,
  },
  permTitle: {
    fontSize: FontSize.displayM, fontWeight: '700', fontFamily: FontFamily.googleSans,
    color: DarkColors.textPrimary, textAlign: 'center', letterSpacing: -0.4,
  },
  permSub: {
    fontSize: FontSize.body, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans,
    textAlign: 'center', lineHeight: 22, maxWidth: 280,
  },
  inkBtn: {
    marginTop: Spacing.px8, height: 56, borderRadius: Radius.full,
    backgroundColor: DarkColors.online, paddingHorizontal: Spacing.px32,
    alignItems: 'center', justifyContent: 'center',
  },
  inkBtnText: { fontSize: FontSize.body, fontWeight: '700', color: DarkColors.bg, fontFamily: FontFamily.googleSans },
  permCancel: { paddingVertical: Spacing.px8, paddingHorizontal: Spacing.px16 },
  permCancelText: { fontSize: FontSize.body, color: DarkColors.textTertiary, fontWeight: '500', fontFamily: FontFamily.googleSans },

  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', alignItems: 'center' },
  topSection: {
    alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 72 : 56,
    paddingHorizontal: Spacing.px32, gap: Spacing.px8,
    backgroundColor: 'rgba(8,33,52,0.72)', width: '100%', paddingBottom: Spacing.px24,
  },
  cameraTitle: { fontSize: FontSize.displayM, fontWeight: '700', color: '#FFFFFF', fontFamily: FontFamily.googleSans, letterSpacing: -0.3 },
  cameraSubtitle: { fontSize: FontSize.label, color: 'rgba(255,255,255,0.70)', fontFamily: FontFamily.googleSans, textAlign: 'center', lineHeight: 20 },
  frameWrap: { alignItems: 'center', justifyContent: 'center' },
  frame: { width: FRAME, height: FRAME, justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 0,    left: 0,  borderTopWidth: BORDER,    borderLeftWidth:  BORDER, borderTopLeftRadius:     6 },
  tr: { top: 0,    right: 0, borderTopWidth: BORDER,    borderRightWidth: BORDER, borderTopRightRadius:    6 },
  bl: { bottom: 0, left: 0,  borderBottomWidth: BORDER, borderLeftWidth:  BORDER, borderBottomLeftRadius:  6 },
  br: { bottom: 0, right: 0, borderBottomWidth: BORDER, borderRightWidth: BORDER, borderBottomRightRadius: 6 },
  spinnerWrap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: Spacing.px32, alignItems: 'center', width: '100%',
    backgroundColor: 'rgba(8,33,52,0.72)', paddingTop: Spacing.px24, gap: Spacing.px12,
  },
  statusPill: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.full,
    paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  statusPillSuccess: { backgroundColor: 'rgba(39,224,126,0.15)', borderColor: 'rgba(39,224,126,0.40)' },
  statusPillError:   { backgroundColor: 'rgba(239,83,80,0.15)',  borderColor: 'rgba(239,83,80,0.40)' },
  statusText: { fontSize: FontSize.label, color: 'rgba(255,255,255,0.80)', fontFamily: FontFamily.googleSans, fontWeight: '500', textAlign: 'center' },
  cancelBtn: { paddingVertical: Spacing.px8, paddingHorizontal: Spacing.px16 },
  cancelText: { fontSize: FontSize.body, color: 'rgba(255,255,255,0.65)', fontFamily: FontFamily.googleSans, fontWeight: '500' },
})
