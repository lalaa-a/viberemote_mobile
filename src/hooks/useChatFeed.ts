/**
 * useChatFeed — unified, windowed chronological feed for one agent session.
 *
 * Loading model (WhatsApp / Telegram style):
 *   • The most-recent page is fetched first and rendered immediately.
 *   • Older pages are pulled lazily via `fetchOlder()` when the user scrolls up.
 *   • New activity streams in at the live edge over Supabase Realtime — no poll.
 *   • A slow 30s poll remains only as a reconnect/missed-event safety net.
 *
 * One server endpoint (GET /mobile/sessions/:id/feed) merges the three sources
 * (terminal_events, pending_requests, mobile_commands) into a single
 * time-ordered, cursor-paginated stream, so this hook never merges across
 * separate paginated queries (which would create gaps at page boundaries).
 *
 * Feed kinds rendered from each source:
 *   terminal → output | activity (tool_start/tool_end) | notify | stop
 *   request  → request (approval card)
 *   prompt   → sent (user prompt bubble)
 */
import { useMemo, useEffect, useRef } from 'react'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { fetchSessionFeed } from '../api/server'
import { getRealtimeClient } from '../api/realtime'
import type { TerminalEvent, PendingRequest, MobileCommand, FeedPage, FeedRow } from '../types'

// ── Chat item discriminated union ──────────────────────────────────────────────

export type ChatItem =
  | { kind: 'output';   id: string; ts: string; event: TerminalEvent }
  | { kind: 'activity'; id: string; ts: string; event: TerminalEvent }  // tool_start / tool_end
  | { kind: 'notify';   id: string; ts: string; event: TerminalEvent }
  | { kind: 'stop';     id: string; ts: string; event: TerminalEvent }
  | { kind: 'request';  id: string; ts: string; req:   PendingRequest }
  | { kind: 'sent';     id: string; ts: string; cmd:   MobileCommand  }

const PAGE_SIZE = 40
const feedKeyFor = (sessionId: string) => ['feed', sessionId] as const

// ── Cache helpers ───────────────────────────────────────────────────────────────
// pages[0] is the NEWEST page (no `before`); subsequent pages are progressively
// older. Each page's items are ascending by created_at.

/** Append a brand-new (newest) row to the live edge = end of the newest page. */
function appendLiveRow(
  data: InfiniteData<FeedPage> | undefined,
  item: FeedRow,
): InfiniteData<FeedPage> | undefined {
  if (!data || !data.pages.length) return data
  // Skip if we already have it on any page (Realtime + poll can both deliver it).
  if (data.pages.some(p => p.items.some(i => i.id === item.id))) return data
  const pages = data.pages.slice()
  const first = pages[0]
  pages[0] = { ...first, items: [...first.items, item] }
  return { ...data, pages }
}

/** Patch an existing row (e.g. a request's approve/deny) wherever it lives. */
function patchRow(
  data: InfiniteData<FeedPage> | undefined,
  id: string,
  patch: Partial<PendingRequest | MobileCommand>,
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

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChatFeed(sessionId: string) {
  const qc = useQueryClient()
  const feedKey = feedKeyFor(sessionId)

  const query = useInfiniteQuery<FeedPage>({
    queryKey: feedKey,
    queryFn: ({ pageParam }) =>
      fetchSessionFeed(sessionId, { before: pageParam as string | undefined, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => (last.hasMore ? last.nextCursor ?? undefined : undefined),
    staleTime:       10_000,
    refetchInterval: 30_000,  // safety net only — Realtime carries the live edge
    // ALWAYS refetch when the chat is (re)opened. Realtime only appends while this screen is
    // mounted; leaving tears the subscription down, so any event that lands while you're away
    // — most importantly the turn-end `stop` — never reaches the cache. Without this, coming
    // back within staleTime serves a stale feed whose last boundary is still an activity, so
    // the composer wrongly shows the agent "working" after a Stop. Refetching on mount pulls
    // the stop (and any trailing output) so the feed walk correctly reads the turn as ended.
    refetchOnMount:  'always',
  })

  // Realtime: push new rows to the live edge and patch decisions in place.
  useEffect(() => {
    let cancelled = false
    let unsub: (() => void) | null = null
    let nudgeTimer: ReturnType<typeof setTimeout> | null = null

    // Coalesce broadcast nudges. postgres_changes already appends each new row
    // cheaply from its payload; the broadcast is only a reconciliation backstop for
    // anything that path drops. Invalidating an infinite query refetches ALL loaded
    // pages, so firing it on every streamed event would thrash a long conversation
    // (the "VirtualizedList slow to update" warning). Debounce so a burst of events
    // triggers at most one refetch after it settles.
    const scheduleReconcile = () => {
      if (nudgeTimer) clearTimeout(nudgeTimer)
      nudgeTimer = setTimeout(() => qc.invalidateQueries({ queryKey: feedKey }), 600)
    }

    ;(async () => {
      const client = await getRealtimeClient()
      if (!client || cancelled) return

      const channel = client
        // Topic name must equal the server broadcast topic (`session:<id>`) so the
        // broadcast nudge below is delivered here. postgres_changes ignores the
        // channel name, so both mechanisms share one channel/socket.
        .channel(`session:${sessionId}`)
        // Reliable live-edge nudge over broadcast (bypasses RLS/replica-identity,
        // which silently drop postgres_changes on self-hosted Supabase — see
        // LIVE_FEED_REALTIME_DIAGNOSIS.md). The server fires this on every feed
        // write; we refetch the user-authed feed endpoint to pull the new tail.
        .on('broadcast', { event: 'feed' }, scheduleReconcile)
        // New agent reasoning / activity
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'terminal_events',
          filter: `session_id=eq.${sessionId}`,
        }, payload => {
          const row = payload.new as TerminalEvent
          qc.setQueryData<InfiniteData<FeedPage>>(feedKey, old =>
            appendLiveRow(old, { source: 'terminal', id: row.id, created_at: row.created_at, row }))
        })
        // New tool approval request — append from the payload (no refetch)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'pending_requests',
          filter: `session_id=eq.${sessionId}`,
        }, payload => {
          const row = payload.new as PendingRequest
          qc.setQueryData<InfiniteData<FeedPage>>(feedKey, old =>
            appendLiveRow(old, { source: 'request', id: row.id, created_at: row.created_at, row }))
        })
        // Decision came in — patch the request row wherever it is
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'pending_requests',
          filter: `session_id=eq.${sessionId}`,
        }, payload => {
          const row = payload.new as PendingRequest
          qc.setQueryData<InfiniteData<FeedPage>>(feedKey, old => patchRow(old, row.id, row))
        })
        // User's sent prompt landed (requires mobile_commands in the Realtime
        // publication — migration 005). INSERT appends; UPDATE patches status.
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'mobile_commands',
          filter: `session_id=eq.${sessionId}`,
        }, payload => {
          const row = payload.new as MobileCommand
          qc.setQueryData<InfiniteData<FeedPage>>(feedKey, old =>
            appendLiveRow(old, { source: 'prompt', id: row.id, created_at: row.created_at, row }))
        })
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'mobile_commands',
          filter: `session_id=eq.${sessionId}`,
        }, payload => {
          const row = payload.new as MobileCommand
          qc.setQueryData<InfiniteData<FeedPage>>(feedKey, old => patchRow(old, row.id, row))
        })
        .subscribe((status, err) => {
          // Without this, a failed/half-open subscription is indistinguishable from
          // a healthy idle one. Surfaces the silent-drop case (stays SUBSCRIBED but
          // delivers nothing) and any CHANNEL_ERROR / TIMED_OUT.
          if (status !== 'SUBSCRIBED') {
            console.warn('[chat realtime]', sessionId, status, err?.message ?? '')
          }
        })

      unsub = () => { try { channel.unsubscribe() } catch {} }
    })()

    return () => {
      cancelled = true
      if (nudgeTimer) clearTimeout(nudgeTimer)
      if (unsub) unsub()
    }
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Stable-identity cache: reuse the same ChatItem object across rebuilds when the
  // underlying row hasn't changed (keyed by id + a small signature). This is what
  // makes React.memo on the row actually skip re-renders — without it every poll/
  // Realtime tick would hand every row a brand-new object and re-render all of them.
  const itemCache = useRef(new Map<string, { sig: string; item: ChatItem }>())

  // Flatten pages oldest→newest, then map each source row to a ChatItem.
  const feed = useMemo<ChatItem[]>(() => {
    const pages = query.data?.pages ?? []
    // pages[0] is newest; reverse so render order is oldest → newest.
    const rows: FeedRow[] = [...pages].reverse().flatMap(p => p.items)

    const cache = itemCache.current
    const nextKeys = new Set<string>()
    const items: ChatItem[] = []
    const seen = new Set<string>()

    for (const { source, id, created_at, row } of rows) {
      if (seen.has(id)) continue
      seen.add(id)

      // Signature captures the only mutable bits that affect rendering.
      let sig: string
      let build: () => ChatItem | null

      if (source === 'terminal') {
        const evt = row as TerminalEvent
        sig = `t:${evt.event_type}:${evt.status ?? ''}`
        build = () => {
          if (evt.event_type === 'output')                                     return { kind: 'output',   id, ts: created_at, event: evt }
          if (evt.event_type === 'tool_start' || evt.event_type === 'tool_end') return { kind: 'activity', id, ts: created_at, event: evt }
          if (evt.event_type === 'notification')                               return { kind: 'notify',   id, ts: created_at, event: evt }
          if (evt.event_type === 'stop')                                       return { kind: 'stop',     id, ts: created_at, event: evt }
          return null
        }
      } else if (source === 'request') {
        const req = row as PendingRequest
        sig = `r:${req.status}:${req.decided_by ?? ''}`
        build = () => ({ kind: 'request', id, ts: created_at, req })
      } else {
        const cmd = row as MobileCommand
        if (cmd.status === 'cancelled') continue
        sig = `p:${cmd.status}`
        build = () => ({ kind: 'sent', id, ts: created_at, cmd })
      }

      const cached = cache.get(id)
      if (cached && cached.sig === sig) {
        items.push(cached.item)
        nextKeys.add(id)
        continue
      }
      const item = build()
      if (!item) continue
      cache.set(id, { sig, item })
      nextKeys.add(id)
      items.push(item)
    }

    // Evict rows that scrolled out of the window so the cache doesn't grow forever.
    for (const key of Array.from(cache.keys())) if (!nextKeys.has(key)) cache.delete(key)

    // Rows already arrive ordered, but Realtime appends and dedupe can perturb it.
    return items.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
  }, [query.data])

  return {
    feed,
    isLoading:       query.isLoading,
    isRefetching:    query.isRefetching && !query.isFetchingNextPage,
    // Older-history pagination
    fetchOlder:      () => { if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage() },
    hasOlder:        query.hasNextPage,
    isFetchingOlder: query.isFetchingNextPage,
    refetch:         () => query.refetch(),
  }
}
