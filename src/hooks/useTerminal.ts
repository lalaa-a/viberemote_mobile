import { useQuery } from '@tanstack/react-query'
import { fetchTerminalEvents } from '../api/server'
import type { TerminalEvent } from '../types'

export function useTerminalEvents(sessionId?: string) {
  return useQuery<TerminalEvent[]>({
    queryKey:        ['terminal', sessionId ?? 'all'],
    queryFn:         async () => {
      const res = await fetchTerminalEvents(sessionId, 60)
      return res.events
    },
    staleTime:       3_000,
    refetchInterval: 5_000,
  })
}
