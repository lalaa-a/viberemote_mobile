import { useQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { fetchRequestById, decideRequest, answerRequest } from '../api/server'
import type { PendingRequest, SelectedAnswer, FeedPage, FeedRow } from '../types'

// ── Single request detail ─────────────────────────────────────────────────────
// Used by RequestDetailScreen (opened from a chat request card).
export function useRequest(id: string) {
  return useQuery({
    queryKey:        ['requests', id],
    queryFn:         () => fetchRequestById(id),
    staleTime:       10_000,
    refetchInterval: 8_000,
  })
}

// ── Approve / deny mutation ───────────────────────────────────────────────────
// The chat feed reads the infinite cache ['feed', sessionId] — NOT a pending list.
// So the optimistic update has to patch the feed cache, or the request card waits
// for the Supabase Realtime UPDATE round-trip (1–4s) before it flips. Patch the
// feed in onMutate; the later Realtime UPDATE carries the same status and is a
// no-op (the feed item signature is keyed on status), so they converge with no
// flicker.

// Patch a request row wherever it lives across all cached feed pages.
// Mirrors patchRow() in useChatFeed so optimistic + Realtime stay in sync.
function patchPendingInFeeds(
  data: InfiniteData<FeedPage> | undefined,
  id: string,
  patch: Partial<PendingRequest>,
): InfiniteData<FeedPage> | undefined {
  if (!data) return data
  return {
    ...data,
    pages: data.pages.map(p => ({
      ...p,
      items: p.items.map(i =>
        i.id === id ? { ...i, row: { ...i.row, ...patch } as FeedRow['row'] } : i,
      ),
    })),
  }
}

export function useDecideRequest() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'approved' | 'denied' }) =>
      decideRequest(id, decision),

    onMutate: async ({ id, decision }) => {
      // Stop in-flight refetches from clobbering the optimistic write.
      await qc.cancelQueries({ queryKey: ['feed'] })

      const patch: Partial<PendingRequest> = {
        status:     decision,
        decided_by: 'mobile',
        decided_at: new Date().toISOString(),
      }

      // Snapshot every feed cache for rollback.
      const prevFeeds = qc.getQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] })

      // 1) THE FIX: flip the card in the chat instantly across any cached feed.
      qc.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: ['feed'] },
        old => patchPendingInFeeds(old, id, patch),
      )

      // 2) Patch a possibly-open detail screen too.
      qc.setQueryData<PendingRequest>(['requests', id], old =>
        old ? { ...old, ...patch } : old,
      )

      return { prevFeeds }
    },

    onError: (_err, _vars, ctx) => {
      // Roll the feed caches back on failure.
      ctx?.prevFeeds?.forEach(([key, data]) => qc.setQueryData(key, data))
    },

    onSettled: (_d, _e, vars) => {
      // Reconcile the detail view with the server (Realtime usually already matches).
      qc.invalidateQueries({ queryKey: ['requests', vars.id] })
    },
  })
}

// ── Answer a question request mutation ────────────────────────────────────────
// Same optimistic pattern as useDecideRequest: patch the feed cache to 'answered'
// so the card locks instantly; the later Realtime UPDATE carries the same status
// (the feed item signature is keyed on status) and is a no-op, so they converge.
export function useAnswerRequest() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, answers }: { id: string; answers: SelectedAnswer[] }) =>
      answerRequest(id, answers),

    onMutate: async ({ id, answers }) => {
      await qc.cancelQueries({ queryKey: ['feed'] })

      const patch: Partial<PendingRequest> = {
        status:           'answered',
        decided_by:       'mobile',
        decided_at:       new Date().toISOString(),
        selected_options: answers,
      }

      const prevFeeds = qc.getQueriesData<InfiniteData<FeedPage>>({ queryKey: ['feed'] })

      qc.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: ['feed'] },
        old => patchPendingInFeeds(old, id, patch),
      )
      qc.setQueryData<PendingRequest>(['requests', id], old =>
        old ? { ...old, ...patch } : old,
      )

      return { prevFeeds }
    },

    onError: (_err, _vars, ctx) => {
      ctx?.prevFeeds?.forEach(([key, data]) => qc.setQueryData(key, data))
    },

    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ['requests', vars.id] })
    },
  })
}
