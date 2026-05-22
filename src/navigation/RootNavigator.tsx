import React from 'react'
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { QRScanScreen } from '../screens/Auth/QRScanScreen'
import { RequestsListScreen } from '../screens/Requests/RequestsListScreen'
import { RequestDetailScreen } from '../screens/Requests/RequestDetailScreen'
import { SessionsScreen } from '../screens/Sessions/SessionsScreen'
import { SessionDetailScreen } from '../screens/Sessions/SessionDetailScreen'
import { PromptComposeScreen } from '../screens/Sessions/PromptComposeScreen'
import { FileBrowserScreen } from '../screens/Sessions/FileBrowserScreen'
import { MachinesScreen } from '../screens/Machines/MachinesScreen'
import { HistoryScreen } from '../screens/History/HistoryScreen'
import { usePendingRequests } from '../hooks/useRequests'
import { useSessions } from '../hooks/useSessions'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { Colors } from '../constants/colors'
import type {
  RootStackParamList,
  TabParamList,
  RequestsStackParamList,
  SessionsStackParamList,
} from '../types'

export const navigationRef = createNavigationContainerRef<RootStackParamList>()

const RootStack     = createNativeStackNavigator<RootStackParamList>()
const Tab           = createBottomTabNavigator<TabParamList>()
const RequestsStack = createNativeStackNavigator<RequestsStackParamList>()
const SessionsStack = createNativeStackNavigator<SessionsStackParamList>()

const HEADER_OPTS = {
  headerStyle:      { backgroundColor: Colors.bgPrimary },
  headerTintColor:  Colors.primary,
  headerTitleStyle: { color: Colors.textPrimary, fontWeight: '600' as const },
  headerBackTitle:  'Back',
}

// ── Requests stack ────────────────────────────────────────────────────────────
function RequestsNavigator() {
  return (
    <RequestsStack.Navigator screenOptions={HEADER_OPTS}>
      <RequestsStack.Screen
        name="RequestsList"
        component={RequestsListScreen}
        options={{ headerShown: false }}
      />
      <RequestsStack.Screen
        name="RequestDetail"
        component={RequestDetailScreen}
        options={{ title: 'Review request' }}
      />
    </RequestsStack.Navigator>
  )
}

// ── Sessions stack ────────────────────────────────────────────────────────────
function SessionsNavigator() {
  return (
    <SessionsStack.Navigator screenOptions={HEADER_OPTS}>
      <SessionsStack.Screen
        name="SessionsList"
        component={SessionsScreen}
        options={{ headerShown: false }}
      />
      <SessionsStack.Screen
        name="SessionDetail"
        component={SessionDetailScreen}
        options={({ route }) => ({
          title: route.params.cwd?.split('/').pop() ?? route.params.machineLabel,
        })}
      />
      <SessionsStack.Screen
        name="RequestDetail"
        component={RequestDetailScreen}
        options={{ title: 'Review request' }}
      />
      <SessionsStack.Screen
        name="FileBrowser"
        component={FileBrowserScreen}
        options={({ route }) => ({ title: `Files · ${route.params.machineLabel}` })}
      />
      <SessionsStack.Screen
        name="PromptCompose"
        component={PromptComposeScreen}
        options={{
          title:        'Send prompt',
          presentation: 'modal',
          headerShown:  false,
        }}
      />
    </SessionsStack.Navigator>
  )
}

// ── Tab bar icon ──────────────────────────────────────────────────────────────
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Requests: '⊡',
    Sessions: '⚡',
    Machines: '◈',
    History:  '◷',
  }
  return (
    <Text style={{ fontSize: 20, color: focused ? Colors.tabActive : Colors.tabInactive }}>
      {icons[label] ?? '○'}
    </Text>
  )
}

// ── Bottom tabs ───────────────────────────────────────────────────────────────
function AppNavigator() {
  const { data: pending  = [] } = usePendingRequests()
  const { data: sessions = [] } = useSessions()
  usePushNotifications()

  const activeSessions = sessions.filter(s => s.status === 'active').length

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown:             false,
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.tabBg,
          borderTopColor:  Colors.border,
          borderTopWidth:  0.5,
          paddingBottom:   4,
          height:          56,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' as const },
        tabBarIcon: ({ focused }) => (
          <TabIcon label={route.name.replace('Tab', '')} focused={focused} />
        ),
      })}
    >
      <Tab.Screen
        name="RequestsTab"
        component={RequestsNavigator}
        options={{
          tabBarLabel: 'Requests',
          tabBarBadge: pending.length > 0 ? pending.length : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.primary,
            color:           Colors.white,
            fontSize:        10,
            fontWeight:      '700',
          },
        }}
      />
      <Tab.Screen
        name="SessionsTab"
        component={SessionsNavigator}
        options={{
          tabBarLabel: 'Sessions',
          tabBarBadge: activeSessions > 0 ? activeSessions : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.success,
            color:           Colors.white,
            fontSize:        10,
            fontWeight:      '700',
          },
        }}
      />
      <Tab.Screen
        name="MachinesTab"
        component={MachinesScreen}
        options={{ tabBarLabel: 'Machines' }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryScreen}
        options={{ tabBarLabel: 'History' }}
      />
    </Tab.Navigator>
  )
}

// ── Root navigator — auth guard ───────────────────────────────────────────────
export function RootNavigator() {
  const { credentials, loading } = useAuth()

  if (loading) return null

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {credentials
          ? <RootStack.Screen name="App"    component={AppNavigator} />
          : <RootStack.Screen name="SignIn" component={QRScanScreen} />
        }
      </RootStack.Navigator>
    </NavigationContainer>
  )
}
