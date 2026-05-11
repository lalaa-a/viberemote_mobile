import React from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import { useAuth } from '../hooks/useAuth'
import { SignInScreen } from '../screens/Auth/SignInScreen'
import { RequestsListScreen } from '../screens/Requests/RequestsListScreen'
import { RequestDetailScreen } from '../screens/Requests/RequestDetailScreen'
import { MachinesScreen } from '../screens/Machines/MachinesScreen'
import { HistoryScreen } from '../screens/History/HistoryScreen'
import { usePendingRequests } from '../hooks/useRequests'
import { Colors } from '../constants/colors'
import type {
  RootStackParamList,
  TabParamList,
  RequestsStackParamList,
} from '../types'

const RootStack     = createNativeStackNavigator<RootStackParamList>()
const Tab           = createBottomTabNavigator<TabParamList>()
const RequestsStack = createNativeStackNavigator<RequestsStackParamList>()

// ── Requests stack (list + detail) ───────────────────────────────────────────
function RequestsNavigator() {
  return (
    <RequestsStack.Navigator
      screenOptions={{
        headerStyle:      { backgroundColor: Colors.bgPrimary },
        headerTintColor:  Colors.primary,
        headerTitleStyle: { color: Colors.textPrimary, fontWeight: '600' },
        headerBackTitle:  'Back',
      }}
    >
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

// ── Tab bar icon (text-based, no icon library needed to start) ────────────────
function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Requests: '⊡',
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
  const { data: pending = [] } = usePendingRequests()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown:     false,
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor:  Colors.tabBg,
          borderTopColor:   Colors.border,
          borderTopWidth:   0.5,
          paddingBottom:    4,
          height:           56,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
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
  const { session, loading } = useAuth()

  if (loading) return null

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {session
          ? <RootStack.Screen name="App"    component={AppNavigator} />
          : <RootStack.Screen name="SignIn" component={SignInScreen} />
        }
      </RootStack.Navigator>
    </NavigationContainer>
  )
}
