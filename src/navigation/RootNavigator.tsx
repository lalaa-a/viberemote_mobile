import React, { useEffect } from 'react'
import {
  NavigationContainer,
  createNavigationContainerRef,
  getFocusedRouteNameFromRoute,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SvgProps } from 'react-native-svg'
import ChatsIcon from '../assets/icons/chats.svg'
import MachinesIcon from '../assets/icons/machines.svg'
import SettingsIcon from '../assets/icons/settings.svg'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../store/useAppStore'
import { getDeviceId } from '../api/device'
import { registerDevice, fetchDevices } from '../api/server'
import { flushPushToken } from '../hooks/usePushNotifications'
import { SignInScreen } from '../screens/Auth/SignInScreen'
import { SignUpScreen } from '../screens/Auth/SignUpScreen'
import { QRScanScreen } from '../screens/Auth/QRScanScreen'
import { SessionsScreen } from '../screens/Sessions/SessionsScreen'
import { ChatScreen } from '../screens/Sessions/ChatScreen'
import { FileBrowserScreen } from '../screens/Sessions/FileBrowserScreen'
import { RequestDetailScreen } from '../screens/Requests/RequestDetailScreen'
import { MachinesScreen } from '../screens/Machines/MachinesScreen'
import { ProfileScreen } from '../screens/Profile/ProfileScreen'
import { useSessions } from '../hooks/useSessions'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { Colors, DarkColors, Radius, Shadow, FontFamily, FontSize } from '../constants/colors'
import type {
  RootStackParamList,
  AuthStackParamList,
  TabParamList,
  SessionsStackParamList,
} from '../types'

export const navigationRef = createNavigationContainerRef<RootStackParamList>()

const RootStack    = createNativeStackNavigator<RootStackParamList>()
const AuthStack    = createNativeStackNavigator<AuthStackParamList>()
const Tab          = createBottomTabNavigator<TabParamList>()
const SessionsStack = createNativeStackNavigator<SessionsStackParamList>()

const HEADER_OPTS = {
  headerStyle:      { backgroundColor: Colors.cream },
  headerTintColor:  Colors.accentDeep,
  headerTitleStyle: { color: Colors.textPrimary, fontSize: FontSize.label, fontWeight: '600' as const },
  headerBackTitle:  'Back',
}

// Full-screen chat-detail routes hide the floating tab bar (Telegram-style).
const HIDE_TAB_BAR_ROUTES = ['Chat', 'RequestDetail', 'FileBrowser']

// ── Tab metadata ──────────────────────────────────────────────────────────────
// Custom SVG icons (stroke="currentColor" → tinted via the `color` prop).
const TAB_ICON: Record<string, React.FC<SvgProps>> = {
  ChatsTab:    ChatsIcon,
  MachinesTab: MachinesIcon,
  ProfileTab:  SettingsIcon,
}

// ── Tab button ────────────────────────────────────────────────────────────────
function TabButton({ routeName, isFocused, badge, onPress }: {
  routeName: string; isFocused: boolean; badge: number; onPress: () => void
}) {
  const Icon  = TAB_ICON[routeName]
  const color = isFocused ? DarkColors.tabActive : DarkColors.tabInactive

  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.tabChip, isFocused && styles.tabChipActive]}>
        {Icon ? <Icon width={26} height={26} color={color} /> : null}
      </View>
      {badge > 0 && (
        <View style={[styles.badge, { backgroundColor: DarkColors.badgeBg }]}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Floating pill tab bar ─────────────────────────────────────────────────────
type FloatingTabBarProps = BottomTabBarProps & { badges: Record<string, number> }

function FloatingTabBar({ state, navigation, badges }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.tabBarWrap, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name)
          }
          return (
            <TabButton
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              badge={badges[route.name] ?? 0}
              onPress={onPress}
            />
          )
        })}
      </View>
    </View>
  )
}

// ── Chats stack ───────────────────────────────────────────────────────────────
function ChatsNavigator() {
  return (
    <SessionsStack.Navigator screenOptions={HEADER_OPTS}>
      <SessionsStack.Screen name="ChatsList" component={SessionsScreen} options={{ headerShown: false }} />
      <SessionsStack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <SessionsStack.Screen name="RequestDetail" component={RequestDetailScreen} options={{ headerShown: false }} />
      <SessionsStack.Screen name="FileBrowser" component={FileBrowserScreen} options={{ headerShown: false }} />
    </SessionsStack.Navigator>
  )
}

// ── App navigator ─────────────────────────────────────────────────────────────
function AppNavigator() {
  const { data: sessions = [] } = useSessions()
  usePushNotifications()

  const activeChats = sessions.filter(s => s.pending_count > 0).reduce((n, s) => n + s.pending_count, 0)

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const tabRoute = props.state.routes[props.state.index]
        const nested   = getFocusedRouteNameFromRoute(tabRoute) ?? ''
        if (HIDE_TAB_BAR_ROUTES.includes(nested)) return null
        return <FloatingTabBar {...props} badges={{ ChatsTab: activeChats }} />
      }}
    >
      <Tab.Screen name="ChatsTab"    component={ChatsNavigator} />
      <Tab.Screen name="MachinesTab" component={MachinesScreen} />
      <Tab.Screen name="ProfileTab"  component={ProfileScreen} />
    </Tab.Navigator>
  )
}

// ── Auth stack ────────────────────────────────────────────────────────────────
function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  )
}

// ── Device bootstrap — runs once after first sign-in ─────────────────────────
function DeviceBootstrap() {
  const session    = useAppStore(s => s.session)
  const deviceId   = useAppStore(s => s.deviceId)
  const setDeviceId = useAppStore(s => s.setDeviceId)

  useEffect(() => {
    if (!session) return

    async function bootstrap() {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android'
      const stored = getDeviceId()
      if (stored) {
        if (!deviceId) setDeviceId(stored)
        // Self-heal: a cached deviceId is stale after a server DB reset (its
        // mobile_devices row is gone), which makes every device-scoped write —
        // push tokens, pairing — fail with a foreign-key error. Confirm it still
        // exists server-side and re-register if not. Only act on a *confirmed*
        // absence; a network error keeps the cached id so we never duplicate.
        try {
          const devices = await fetchDevices()
          if (!devices.some(d => d.id === stored)) {
            await registerDevice('Phone', platform)
          }
        } catch {
          // couldn't verify (offline/transient) — keep the cached id as-is
        }
      } else {
        await registerDevice('Phone', platform)
      }
      // deviceId is now valid — flush any FCM token cached before it was ready
      await flushPushToken()
    }

    bootstrap().catch(console.warn)
  }, [session?.user?.id])

  return null
}

// ── Root — auth guard ─────────────────────────────────────────────────────────
export function RootNavigator() {
  const { session, loading } = useAuth()
  if (loading) return null

  return (
    <NavigationContainer ref={navigationRef}>
      <DeviceBootstrap />
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {session
          ? <RootStack.Screen name="App"  component={AppNavigator} />
          : <RootStack.Screen name="Auth" component={AuthNavigator} />
        }
        {/* QRScan presented as a full-screen modal from any tab */}
        <RootStack.Screen name="QRScan" component={QRScanScreen} options={{ presentation: 'modal', headerShown: false }} />
      </RootStack.Navigator>
    </NavigationContainer>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Centered, content-hugging pill (not full-width)
  tabBarWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row', height: 64, borderRadius: Radius.full,
    backgroundColor: DarkColors.surface,
    alignItems: 'center', paddingHorizontal: 12, gap: 20, ...Shadow.float,
  },
  tabBtn:       { alignItems: 'center', justifyContent: 'center', height: '100%' },
  // Active highlight is a pill (matches the nav bar's full radius)
  tabChip:      { width: 58, height: 44, borderRadius: Radius.full, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tabChipActive:{ backgroundColor: DarkColors.surfaceRaised },
  badge: {
    position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16,
    borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 2, borderColor: DarkColors.surface,
  },
  badgeText: { fontSize: 9, color: Colors.white, fontWeight: '700' },
})
