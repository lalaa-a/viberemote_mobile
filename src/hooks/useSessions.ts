import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSessions,
  fetchSessionRequests,
  fetchPrompts,
  sendPrompt,
  cancelPrompt,
  stopSession,
} from '../api/server'

export function useSessions() {
  return useQuery({
    queryKey:        ['sessions'],
    queryFn:         fetchSessions,
    staleTime:       0,
    // Realtime (useSessionsRealtime) is the instant path — new sessions, status
    // transitions, and pending_count all push and invalidate this query. This poll
    // is now only a reconnect backstop.
    refetchInterval: 15_000,
  })
}

export function useSessionRequests(sessionId: string) {
  return useQuery({
    queryKey:        ['sessions', sessionId, 'requests'],
    queryFn:         () => fetchSessionRequests(sessionId),
    staleTime:       0,
    refetchInterval: 8_000,
  })
}

export function usePrompts() {
  return useQuery({
    queryKey:        ['prompts'],
    queryFn:         fetchPrompts,
    staleTime:       0,
    refetchInterval: 10_000,
  })
}

export function useSendPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ prompt, sessionId }: { prompt: string; sessionId?: string }) =>
      sendPrompt(prompt, sessionId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
  })
}

export function useCancelPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelPrompt(id),
    onSettled:  () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] })
    },
  })
}

// Interrupts the current turn only — does NOT kill the harness CLI process.
// See STOP_AGENT_DESIGN.md.
export function useStopSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => stopSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })
}
