import { useEffect } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '../api/supabase'
import {
  fetchPendingRequests,
  fetchRequestById,
  fetchHistory,
  decideRequest,
} from '../api/requests'
import type { PendingRequest } from '../types'

// ── Pending requests list with realtime ───────────────────────────────────────
export function usePendingRequests() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey:  ['requests', 'pending'],
    queryFn:   fetchPendingRequests,
    staleTime: 30_000,
  })

  useEffect(() => {
    const channel = supabase
      .channel(`requests-realtime-${Date.now()}`)

      // New request inserted — prepend to list
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'pending_requests',
        filter: 'status=eq.pending',
      }, ({ new: row }) => {
        queryClient.setQueryData<PendingRequest[]>(
          ['requests', 'pending'],
          (prev = []) => [row as PendingRequest, ...prev]
        )
      })

      // Request updated — remove from pending if no longer pending
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'pending_requests',
      }, ({ new: row }) => {
        const updated = row as PendingRequest
        if (updated.status !== 'pending') {
          queryClient.setQueryData<PendingRequest[]>(
            ['requests', 'pending'],
            (prev = []) => prev.filter(r => r.id !== updated.id)
          )
        }
        // Refresh the individual request cache
        queryClient.setQueryData(['requests', updated.id], updated)
      })

      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient])

  return query
}

// ── Single request detail ─────────────────────────────────────────────────────
export function useRequest(id: string) {
  return useQuery({
    queryKey: ['requests', id],
    queryFn:  () => fetchRequestById(id),
    staleTime: 10_000,
  })
}

// ── History ───────────────────────────────────────────────────────────────────
export function useHistory() {
  return useQuery({
    queryKey: ['requests', 'history'],
    queryFn:  fetchHistory,
    staleTime: 60_000,
  })
}

// ── Approve / deny mutation ───────────────────────────────────────────────────
export function useDecideRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, decision }: {
      id:       string
      decision: 'approved' | 'denied'
    }) => decideRequest(id, decision),

    // Optimistic update — remove from list immediately, don't wait for server
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['requests', 'pending'] })
      const previous = queryClient.getQueryData<PendingRequest[]>(['requests', 'pending'])
      queryClient.setQueryData<PendingRequest[]>(
        ['requests', 'pending'],
        (prev = []) => prev.filter(r => r.id !== id)
      )
      return { previous }
    },

    // Roll back on error
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['requests', 'pending'], context.previous)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', 'history'] })
    },
  })
}
