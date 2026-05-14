import React, { useState, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, StatusBar,
} from 'react-native'
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera'
import {
  verifyCredentials,
  saveCredentials,
  type MachineCredentials,
} from '../../api/server'
import { useAppStore } from '../../store/useAppStore'
import Config from 'react-native-config'
import { Colors, Spacing, Radius, FontSize } from '../../constants/colors'

interface QRPayload {
  machineId:   string
  apiKey:      string
  supabaseUrl: string
  apiUrl:      string
}

export function QRScanScreen() {
  const setCredentials = useAppStore(s => s.setCredentials)
  const { hasPermission, requestPermission } = useCameraPermission()
  const device       = useCameraDevice('back')
  const [loading,    setLoading] = useState(false)
  const [debugMsg,   setDebugMsg] = useState('Waiting for QR…')
  const isProcessing = useRef(false)

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (isProcessing.current) return

      setDebugMsg(`Codes seen: ${codes.length}`)

      const raw = codes[0]?.value
      if (!raw) { setDebugMsg('Code detected but no value'); return }

      setDebugMsg(`Raw: ${raw.slice(0, 60)}`)

      let payload: QRPayload
      try {
        payload = JSON.parse(raw)
      } catch {
        setDebugMsg('JSON parse failed')
        return
      }

      if (!payload.machineId || !payload.apiKey) {
        setDebugMsg(`Missing fields. Keys: ${Object.keys(payload).join(', ')}`)
        return
      }

      // apiUrl is optional in the QR — falls back to the .env value
      const apiUrl = payload.apiUrl || Config.API_URL || ''
      if (!apiUrl) {
        setDebugMsg('No apiUrl in QR and API_URL not set in .env')
        return
      }

      isProcessing.current = true
      setLoading(true)
      setDebugMsg('Verifying with server…')

      const creds: MachineCredentials = {
        machineId:   payload.machineId,
        apiKey:      payload.apiKey,
        supabaseUrl: payload.supabaseUrl ?? '',
        apiUrl,
      }

      verifyCredentials(creds)
        .then(() => {
          saveCredentials(creds)
          setCredentials(creds)
        })
        .catch((err: any) => {
          setDebugMsg(`Server error: ${err.message}`)
          Alert.alert(
            'Connection failed',
            err.message ?? 'Could not connect to machine.',
            [{ text: 'Try again', onPress: () => {
              isProcessing.current = false
              setLoading(false)
              setDebugMsg('Waiting for QR…')
            }}]
          )
        })
    },
  })

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Text style={styles.permText}>Camera access is required to scan the QR code.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text style={styles.permText}>No camera found on this device.</Text>
      </View>
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

      {/* Overlay */}
      <View style={styles.overlay}>
        <View style={styles.topSection}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>AC</Text>
          </View>
          <Text style={styles.title}>Agent Control</Text>
          <Text style={styles.subtitle}>
            Open the desktop app and scan the QR code shown on the dashboard.
          </Text>
        </View>

        {/* Scan frame */}
        <View style={styles.frameWrap}>
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            {loading && (
              <View style={styles.spinnerWrap}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.connectingText}>Connecting…</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomSection}>
          <Text style={styles.hint}>
            Point your camera at the QR code on the Vibe Remote desktop app.
          </Text>
          <View style={styles.debugBox}>
            <Text style={styles.debugText}>{debugMsg}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}

const FRAME = 240
const CORNER = 24
const BORDER = 3

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#000',
  },
  center: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: Colors.bgPrimary,
    padding:         Spacing.xxl,
    gap:             Spacing.lg,
  },
  permText: {
    fontSize:  FontSize.md,
    color:     Colors.textSecondary,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical:   Spacing.md,
    borderRadius:      Radius.md,
  },
  btnText: {
    color:      Colors.white,
    fontWeight: '600',
    fontSize:   FontSize.md,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'space-between',
    alignItems:     'center',
  },
  topSection: {
    alignItems:      'center',
    paddingTop:      60,
    paddingHorizontal: Spacing.xxl,
    gap:             Spacing.sm,
  },
  logoBox: {
    width:           48,
    height:          48,
    borderRadius:    Radius.lg,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Spacing.xs,
  },
  logoText: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.white,
  },
  title: {
    fontSize:   FontSize.xl,
    fontWeight: '700',
    color:      '#fff',
  },
  subtitle: {
    fontSize:  FontSize.sm,
    color:     'rgba(255,255,255,0.75)',
    textAlign: 'center',
    lineHeight: 20,
  },
  frameWrap: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  frame: {
    width:           FRAME,
    height:          FRAME,
    justifyContent:  'center',
    alignItems:      'center',
  },
  corner: {
    position:  'absolute',
    width:     CORNER,
    height:    CORNER,
    borderColor: Colors.primary,
  },
  tl: {
    top:         0,
    left:        0,
    borderTopWidth:  BORDER,
    borderLeftWidth: BORDER,
    borderTopLeftRadius: 4,
  },
  tr: {
    top:          0,
    right:        0,
    borderTopWidth:   BORDER,
    borderRightWidth: BORDER,
    borderTopRightRadius: 4,
  },
  bl: {
    bottom:           0,
    left:             0,
    borderBottomWidth: BORDER,
    borderLeftWidth:   BORDER,
    borderBottomLeftRadius: 4,
  },
  br: {
    bottom:            0,
    right:             0,
    borderBottomWidth:  BORDER,
    borderRightWidth:   BORDER,
    borderBottomRightRadius: 4,
  },
  spinnerWrap: {
    alignItems: 'center',
    gap:        Spacing.sm,
  },
  connectingText: {
    color:    '#fff',
    fontSize: FontSize.sm,
  },
  bottomSection: {
    paddingBottom:     48,
    paddingHorizontal: Spacing.xxl,
  },
  hint: {
    fontSize:  FontSize.xs,
    color:     'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
  debugBox: {
    marginTop:         12,
    backgroundColor:   'rgba(0,0,0,0.6)',
    borderRadius:      6,
    paddingHorizontal: 10,
    paddingVertical:   6,
  },
  debugText: {
    fontSize:   10,
    color:      '#0f0',
    fontFamily: 'monospace',
    textAlign:  'center',
  },
})
