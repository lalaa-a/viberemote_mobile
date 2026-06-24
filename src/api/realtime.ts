import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Config from 'react-native-config'
import { useAppStore } from '../store/useAppStore'

let client:       SupabaseClient | null = null
let currentToken: string | null         = null

export async function getRealtimeClient(): Promise<SupabaseClient | null> {
  const session = useAppStore.getState().session
  if (!session) return null

  if (client && currentToken) return client

  try {
    const res = await fetch(`${Config.API_URL}/mobile/realtime-token`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    })
    if (!res.ok) {
      console.warn('[realtime] token fetch failed', res.status)
      return null
    }
    const { token } = (await res.json()) as { token: string }

    // The client key MUST be the anon key — on self-hosted Supabase the Realtime
    // WebSocket connects through the Kong gateway, which validates the `apikey`
    // against its registered consumers (anon / service keys). A user-signed JWT is
    // not a valid Kong apikey, so passing it here makes Kong reject the socket and
    // Realtime never connects (REST still works because it goes via the Express
    // API, not Kong). The user JWT is supplied separately via setAuth() so RLS on
    // postgres_changes still resolves auth.uid(). This matches the desktop daemon
    // (relay-deamon1/src/config.js) and the mobile main client (api/supabase.ts).
    client = createClient(Config.SUPABASE_URL!, Config.SUPABASE_ANON_KEY!, {
      auth:     { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 10 } },
    })
    client.realtime.setAuth(token)
    currentToken = token
  } catch (err) {
    console.warn('[realtime] client init error', err)
    return null
  }

  return client
}

export function clearRealtimeClient() {
  if (client) {
    try { client.realtime.disconnect() } catch {}
  }
  client       = null
  currentToken = null
}
