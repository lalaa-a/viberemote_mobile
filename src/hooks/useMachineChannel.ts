import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getRealtimeClient } from '../api/realtime'

// Subscribe to a machine's broadcast channel and refresh harness/session state the
// instant the desktop reports a change — e.g. a harness toggled on/off. The server
// fires `broadcastMachine(machineId, 'harness')` from POST /harness/report, which
// the desktop calls immediately on every toggle. Without this, the phone waits up
// to 30s (Machines tab) or 10s (chat composer) for the next poll. Polling remains
// the backstop if a broadcast is ever missed.
export function useMachineChannel(machineId?: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!machineId) return

    let cancelled = false
    let unsub: (() => void) | null = null

    ;(async () => {
      const client = await getRealtimeClient()
      if (!client || cancelled) return

      const channel = client
        .channel(`machine:${machineId}`)
        .on('broadcast', { event: 'harness' }, () => {
          qc.invalidateQueries({ queryKey: ['harnesses', machineId] })
          qc.invalidateQueries({ queryKey: ['machines'] })
          qc.invalidateQueries({ queryKey: ['sessions'] })
        })
        .subscribe((status, err) => {
          if (status !== 'SUBSCRIBED') {
            console.warn('[machine realtime]', machineId, status, err?.message ?? '')
          }
        })

      unsub = () => { try { channel.unsubscribe() } catch {} }
    })()

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [machineId]) // eslint-disable-line react-hooks/exhaustive-deps
}
