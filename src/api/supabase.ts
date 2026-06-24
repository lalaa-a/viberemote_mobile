import { createClient } from '@supabase/supabase-js'
import { createMMKV } from 'react-native-mmkv'
import Config from 'react-native-config'

const storage = createMMKV({ id: 'supabase-auth' })

// If the Supabase URL changed (e.g. switched projects), wipe the stale auth cache
// so the old project's session tokens don't cause 401s against the new project.
const AUTH_URL_KEY = '__supabase_url__'
const _prevUrl = storage.getString(AUTH_URL_KEY)
if (_prevUrl && _prevUrl !== Config.SUPABASE_URL) {
  storage.clearAll()
}
storage.set(AUTH_URL_KEY, Config.SUPABASE_URL!)

// MMKV is synchronous and 30x faster than AsyncStorage
// Critical for auth token reads at app startup
const MMKVAdapter = {
  getItem:    (key: string): string | null =>
    storage.getString(key) ?? null,
  setItem:    (key: string, value: string): void =>
    storage.set(key, value),
  removeItem: (key: string): void => {
    storage.remove(key)
  },
}

export const supabase = createClient(
  Config.SUPABASE_URL!,
  Config.SUPABASE_ANON_KEY!,
  {
    auth: {
      storage:            MMKVAdapter,
      autoRefreshToken:   true,
      persistSession:     true,
      detectSessionInUrl: false,   // must be false for React Native
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)
