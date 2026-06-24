/**
 * useSessionsRealtime — push the sessions list off the 5s poll.
 *
 * Subscribes to the two tables that drive the list — `agents` (new sessions,
 * status/cli_alive transitions) and `pending_requests` (pending_count) — for the
 * given machines, and invalidates ['sessions'] on any change. The poll in
 * useSessions then becomes a backstop (15s).
 *
 * Invalidate (not patch) on purpose: the sessions list is small and the query is
 * its own source of truth, so a cheap refetch on change is simpler and safer than
 * reconstructing rows from CDC payloads.
 *
 * ⚠️ Requires `agents` to be in the supabase_realtime publication — see server
 * migration 009_realtime_agents.sql. Without it, only the pending_requests half
 * fires (new sessions / idle transitions fall back to the 15s poll).
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRealtimeClient } from '../api/realtime'

export function useSessionsRealtime(machineIds: string[]) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!machineIds.length) return
    let cancelled = false
    let unsub: (() => void) | null = null

    ;(async () => {
      const client = await getRealtimeClient()
      if (!client || cancelled) return

      const inList = `machine_id=in.(${machineIds.join(',')})`
      const bump   = () => qc.invalidateQueries({ queryKey: ['sessions'] })

      const channel = client
        .channel('sessions')
        // New sessions + status/cli_alive transitions
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'agents', filter: inList }, bump)
        // pending_count changes (new approval / decision)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'pending_requests', filter: inList }, bump)
        .subscribe((status, err) => {
          if (status !== 'SUBSCRIBED') {
            console.warn('[sessions realtime]', status, err?.message ?? '')
          }
        })

      unsub = () => { try { channel.unsubscribe() } catch {} }
    })()

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [machineIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
}
