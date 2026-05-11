import { useEffect } from 'react'
import { Platform, Alert } from 'react-native'
import messaging from '@react-native-firebase/messaging'
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
} from '@notifee/react-native'
import { supabase } from '../api/supabase'
import { useNavigation } from '@react-navigation/native'

// ── Request permission (Android 13+ requires explicit permission) ─────────────
async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const { PermissionsAndroid } = require('react-native')
    if (Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      )
      return result === PermissionsAndroid.RESULTS.GRANTED
    }
    return true
  }

  const authStatus = await messaging().requestPermission()
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  )
}

// ── Save FCM token to Supabase so the edge function can send pushes ───────────
async function savePushToken(token: string) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('push_tokens')
    .upsert(
      { user_id: user.id, token, platform: Platform.OS },
      { onConflict: 'user_id' }
    )
}

// ── Create the notification channel (Android only) ───────────────────────────
async function ensureChannel() {
  await notifee.createChannel({
    id:         'agent-requests',
    name:       'Agent requests',
    importance: AndroidImportance.HIGH,
    visibility: AndroidVisibility.PUBLIC,
    vibration:  true,
    sound:      'default',
  })
}

// ── Display an incoming FCM message as a local notification ──────────────────
async function displayNotification(remoteMessage: any) {
  await notifee.displayNotification({
    title: remoteMessage.notification?.title ?? 'Approval needed',
    body:  remoteMessage.notification?.body  ?? 'A tool-use request is waiting',
    data:  remoteMessage.data,
    android: {
      channelId:  'agent-requests',
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
      // Show request ID in the notification for context
      tag: remoteMessage.data?.requestId,
    },
  })
}

// ── Hook — call this once in App.tsx or a top-level screen ───────────────────
export function usePushNotifications() {
  const navigation = useNavigation<any>()

  useEffect(() => {
    let unsubscribeForeground: (() => void) | undefined
    let unsubscribeNotifee:    (() => void) | undefined

    async function setup() {
      try {
        const granted = await requestPermission()
        if (!granted) return

        await ensureChannel()

        // Get and save the FCM token
        const token = await messaging().getToken()
        await savePushToken(token)

        // Refresh token if it rotates
        const unsubToken = messaging().onTokenRefresh(savePushToken)

        // Foreground messages — app is open, show a local notification
        unsubscribeForeground = messaging().onMessage(displayNotification)

        // Notifee foreground events — user tapped the notification
        unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
          if (type === EventType.PRESS) {
            const requestId = detail.notification?.data?.requestId
            if (requestId) {
              navigation.navigate('RequestsTab', {
                screen: 'RequestDetail',
                params: { id: requestId },
              })
            }
          }
        })

        return unsubToken
      } catch (e) {
        console.warn('[FCM] Push notification setup skipped — Firebase not initialised:', e)
      }
    }

    const cleanup = setup()

    // Background / quit — notification tap deep-links into the app
    try {
      messaging()
        .getInitialNotification()
        .then(remoteMessage => {
          if (remoteMessage?.data?.requestId) {
            // Slight delay to let navigation mount
            setTimeout(() => {
              navigation.navigate('RequestsTab', {
                screen: 'RequestDetail',
                params: { id: remoteMessage.data!.requestId },
              })
            }, 500)
          }
        })
    } catch (_) {
      // Firebase not yet configured
    }

    return () => {
      cleanup.then(unsub => unsub?.())
      unsubscribeForeground?.()
      unsubscribeNotifee?.()
    }
  }, [navigation])
}

// ── Background message handler — must be registered outside React ─────────────
// Call this in index.js BEFORE AppRegistry.registerComponent
export function registerBackgroundHandler() {
  try {
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      await ensureChannel()
      await displayNotification(remoteMessage)
    })
  } catch (e) {
    // Firebase not yet configured (google-services.json missing / native plugin disabled)
    console.warn('[FCM] registerBackgroundHandler skipped — Firebase not initialised:', e)
  }
}
