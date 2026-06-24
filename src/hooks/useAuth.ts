import { useEffect, useState } from 'react'
import { supabase } from '../api/supabase'
import { useAppStore } from '../store/useAppStore'
import { clearRealtimeClient } from '../api/realtime'

export function useAuth() {
  const session    = useAppStore(s => s.session)
  const setSession = useAppStore(s => s.setSession)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load persisted session on startup
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setLoading(false)
    })

    // Keep store in sync with token refreshes and sign-out
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        setSession(s)
        if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          clearRealtimeClient()
        }
        if (event === 'INITIAL_SESSION') {
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signOut() {
    clearRealtimeClient()
    await supabase.auth.signOut()
  }

  async function resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  return {
    session,
    user:    session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }
}
