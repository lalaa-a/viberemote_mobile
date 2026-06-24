import React from 'react'
import { View, Text, StyleSheet, StatusBar, AppState, type AppStateStatus } from 'react-native'
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { RootNavigator } from './src/navigation/RootNavigator'
import { useAppStore } from './src/store/useAppStore'
import { Colors, FontSize, Radius, Spacing } from './src/constants/colors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:             2,
      retryDelay:        1000,
      staleTime:         30_000,
      gcTime:            5 * 60_000,
      // Realtime carries the live edge; polling is only a backstop. Don't burn
      // requests on screens the user isn't looking at or while backgrounded.
      refetchIntervalInBackground: false,
      refetchOnWindowFocus:        false,
    },
    mutations: {
      retry: 1,
    },
  },
})

// Tie React Query's "focus" to RN app state so timers pause in the background and
// resume (with a single refetch) on foreground — App State drives focusManager.
AppState.addEventListener('change', (s: AppStateStatus) =>
  focusManager.setFocused(s === 'active'),
)

// ── Toast notification ────────────────────────────────────────────────────────
function Toast() {
  const toast = useAppStore(s => s.toast)
  if (!toast) return null

  return (
    <View style={[
      styles.toast,
      { backgroundColor: toast.type === 'success' ? Colors.success : Colors.danger }
    ]}>
      <Text style={styles.toastText}>{toast.message}</Text>
    </View>
  )
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar barStyle="dark-content" />
          <RootNavigator />
          <Toast />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  toast: {
    position:        'absolute',
    bottom:          90,
    left:            Spacing.lg,
    right:           Spacing.lg,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    alignItems:      'center',
    zIndex:          9999,
  },
  toastText: {
    color:      Colors.white,
    fontSize:   FontSize.sm,
    fontWeight: '600',
  },
})
