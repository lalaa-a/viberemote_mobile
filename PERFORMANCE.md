# Chat Screen Performance & Realtime Optimization

This document diagnoses the "chat scrolls back down when I try to scroll up" bug and the
broader sluggishness of the live feed, then argues through the options and lands on a
concrete plan. It also answers the recurring question: **"should we replace this with
WebSockets?"** (Short answer: you already have WebSockets — the fix is to *use* them and
stop fighting them with polling.)

---

## 1. Symptoms

1. **Scroll fights the user.** Scroll up to read history and the list snaps back to the
   bottom a second or two later.
2. **Visible re-render churn.** Bubbles flicker / the list feels janky while the agent
   is working.
3. **Battery / data.** Three queries poll every 5s per open chat, one of them
   (`prompts`) fetches *all* prompts globally and filters client-side.

All three have the same root family of causes. Let's separate them.

---

## 2. Root cause analysis (grounded in the actual code)

### 2.1 The scroll bug — TWO competing auto-scroll triggers

There are two independent "jump to bottom" mechanisms, and they fire on events that have
nothing to do with the user sending a message:

**Trigger A — `ChatScreen.tsx:283-287`**
```tsx
useEffect(() => {
  if (feed.length > 0) {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }
}, [feed.length])
```
Fires every time the feed *count* changes — i.e. every time the 5s poll or a Realtime
event brings a new row, **regardless of where the user is scrolled.**

**Trigger B — `ChatScreen.tsx:394-396` (the worse one)**
```tsx
onContentSizeChange={() =>
  listRef.current?.scrollToEnd({ animated: false })
}
```
`onContentSizeChange` fires on **any** change to the measured content height. That
includes:
- Every 5s poll that re-renders rows (FlatList re-measures recycled rows).
- Tapping **"Show more / Show less"** on an `OutputBubble` (it has local
  `useState(expanded)` at `ChatScreen.tsx:43`, so its height changes).
- Keyboard open/close, font/layout shifts.

So the exact reproduction is: *you scroll up → 5s poll returns → content re-measures →
`onContentSizeChange` → `scrollToEnd({animated:false})` → you're slammed to the bottom.*

**This is the bug.** It is a pure client-side logic problem. It is not caused by polling
vs websockets — but polling makes it fire constantly because polling forces a re-measure
every 5 seconds.

### 2.2 Polling is redundant with Realtime, and one query is global

`useChatFeed.ts` runs **three** polled queries, each `refetchInterval: 5_000`:
- `['terminal', sessionId]` — `useChatFeed.ts:42-50`
- `['session-requests-all', sessionId]` — `useChatFeed.ts:54-59`
- `['prompts']` — `useChatFeed.ts:62-67` — **fetched globally, filtered client-side**
  (`useChatFeed.ts:135-139`)

At the same time, `useChatFeed.ts:70-116` already subscribes to Supabase Realtime for
`terminal_events` (INSERT) and `pending_requests` (INSERT + UPDATE). So for those two
tables you are paying for **both** a websocket push **and** a 5s poll. The poll is the one
causing the re-measure churn that drives the scroll bug and the flicker.

Two gaps in the current Realtime coverage:
- **`mobile_commands` (sent prompts) has no Realtime subscription** — it relies entirely
  on the global `['prompts']` poll. That is the one query that genuinely needs *some*
  refresh mechanism today.
- New `pending_requests` INSERT does a full `invalidateQueries` → refetch
  (`useChatFeed.ts:95`) instead of inserting the row from the payload, so an approval
  request still triggers a network round-trip.

### 2.3 Render cost on every feed change

- `feed` is rebuilt and re-sorted on every change of any of the three queries
  (`useChatFeed.ts:119-142`). Each poll returns **new array/object references**, so the
  `useMemo` always recomputes and every `ChatItem` is a brand-new object.
- `FeedRow` (`ChatScreen.tsx:231`) is **not** wrapped in `React.memo`, and `renderItem`
  passes fresh inline closures, so **every row re-renders on every poll** even when its
  content is identical.
- `formatDistanceToNow(...)` runs for every visible bubble on every render
  (`ChatScreen.tsx:61, 81, 108, 181`).
- No FlatList virtualization tuning (`windowSize`, `maxToRenderPerBatch`,
  `getItemLayout`) and no `removeClippedSubviews`.

---

## 3. The WebSocket question — argued

> "Can we replace this with WebSockets to make it smooth?"

**You already run on WebSockets.** Supabase Realtime is a WebSocket transport carrying
Postgres change-data-capture. `getRealtimeClient()` + `channel('chat:...')` in
`useChatFeed.ts` is a live socket today. So the real decision is not "add websockets,"
it's **"how much should we lean on the socket vs. keep polling, and do we need a *custom*
socket server?"**

### Option A — Keep Supabase Realtime, demote polling to a safety net (RECOMMENDED)

Lean on the existing websocket for liveness; keep a *slow* poll (20–30s) only as a
reconnect/missed-event backstop.

- **Pros:** Removes the 5s re-measure churn (kills the scroll bug's trigger and the
  flicker). Almost no new code — it's deletion and interval changes. Keeps RLS-enforced
  auth, reconnection, and horizontal scaling that Supabase already gives you. Lowest risk.
- **Cons:** Still depends on Supabase Realtime connection limits (500 on free tier,
  10k on Pro — see server `SCALING.md`). Sent-prompt status still needs a refresh path
  (solved by adding a `mobile_commands` subscription, or keeping a slow poll for just
  that one query).
- **Effort:** ~half a day. **Risk:** low.

### Option B — Build a custom WebSocket gateway (Socket.io / ws) replacing Realtime

Stand up a dedicated socket server on the VPS; desktop, mobile, and server all speak one
protocol; push the already-merged feed to clients.

- **Pros:** Full control of payloads (push the merged feed, no client-side merge);
  unifies desktop↔server↔mobile messaging; could also replace the desktop's HTTP polling
  (`heartbeat.js` fs/prompt polls). Presence/typing indicators become easy.
- **Cons:** You re-implement what Supabase already gives you for free: auth, RLS
  equivalents, reconnection, fan-out, and **horizontal scaling**. A stateful socket
  server breaks the current "stateless Express behind a proxy, run PM2 cluster" model —
  you'd need sticky sessions or a Redis adapter for multi-instance. Significant new
  surface area and ops burden. **Premature at 0–50 users.**
- **Effort:** 1–2 weeks + ongoing ops. **Risk:** high.

### Option C — Realtime Broadcast instead of Postgres-changes

Use Supabase Realtime *Broadcast* channels (server `POST`s an event to a channel) rather
than `postgres_changes` CDC.

- **Pros:** Lower DB/Realtime load than per-row CDC at scale; you control the payload
  shape; fewer subscriptions.
- **Cons:** The server must explicitly publish on every change (more server code); loses
  the "free" automatic row events. Worth it only once CDC volume becomes a cost problem.
- **Effort:** ~2–3 days. **Risk:** medium.

### Decision

**Adopt Option A now.** It directly removes the cause of the scroll jank and the render
churn, costs almost nothing, and keeps the operational simplicity that suits the current
scale. **Revisit Option C** when Realtime connection count or CDC volume shows up in
Supabase metrics. **Only consider Option B** if/when you need server-pushed desktop
control or you outgrow Supabase Realtime's limits — it is not justified today.

The headline: **the smoothness problem is a client logic + polling-churn problem, not a
transport problem.** Swapping transports without fixing the scroll logic would leave the
bug in place.

---

## 4. The fix plan

### Fix 1 — Make auto-scroll conditional (kills the scroll bug)

Only auto-scroll when the user is already at (or near) the bottom. Track position via
`onScroll`, and remove the unconditional `onContentSizeChange` jump.

```tsx
// ── refs/state near the top of ChatScreen ──
const isNearBottomRef = useRef(true)        // user is at the live edge
const [showJumpToLatest, setShowJumpToLatest] = useState(false)

const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
  const distanceFromBottom =
    contentSize.height - (contentOffset.y + layoutMeasurement.height)
  const near = distanceFromBottom < 120          // ~one bubble of slack
  isNearBottomRef.current = near
  setShowJumpToLatest(!near)
}, [])
```

Replace the two existing triggers:

```tsx
// REPLACE the feed.length effect (ChatScreen.tsx:283-287)
useEffect(() => {
  if (feed.length > 0 && isNearBottomRef.current) {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
  }
}, [feed.length])
```

```tsx
// On the FlatList:
onScroll={handleScroll}
scrollEventThrottle={16}
// REMOVE the unconditional onContentSizeChange scrollToEnd (ChatScreen.tsx:394-396).
// Optionally gate it the same way if you want first-mount snap-to-bottom:
onContentSizeChange={() => {
  if (isNearBottomRef.current) listRef.current?.scrollToEnd({ animated: false })
}}
maintainVisibleContentPosition={{ minIndexForVisible: 0 }} // anchors view when rows arrive
```

Add a small **"Jump to latest ↓"** pill shown when `showJumpToLatest` is true, so the user
can opt back into the live edge. This is the standard chat-app pattern (WhatsApp, Slack):
auto-follow only when already at the bottom; otherwise stay put and offer a jump button.

> `maintainVisibleContentPosition` is the proper RN primitive for "don't move the viewport
> when content is inserted." It's solid on iOS and on Android with the New Architecture; if
> you're on old-arch Android, the `isNearBottomRef` gate alone already fixes the reported
> bug.

**Alternative considered — `inverted` FlatList.** An inverted list keeps the newest item
at the bottom for free and never needs `scrollToEnd`. It's a clean model for chat, but it
requires reversing the data, flipping `ListHeader`/`ListFooter` (your `ThinkingBubble`
footer becomes a header), and it interacts awkwardly with `KeyboardAvoidingView` and the
compose bar. Given the screen already works structurally, the conditional-scroll fix is
lower risk. Keep `inverted` as a future option if you rebuild the feed.

### Fix 2 — Lean on Realtime, demote polling

In `useChatFeed.ts`, raise the poll intervals from 5s to a slow safety net and let the
websocket carry liveness:

```tsx
// terminal + requests queries
staleTime:       10_000,
refetchInterval: 30_000,   // was 5_000 — Realtime carries the live updates
```

For the new-request case, insert from the payload instead of invalidating
(`useChatFeed.ts:90-96`):

```tsx
.on('postgres_changes', {
  event: 'INSERT', schema: 'public', table: 'pending_requests',
  filter: `session_id=eq.${sessionId}`,
}, (payload) => {
  const row = payload.new as PendingRequest
  qc.setQueryData<PendingRequest[]>(reqsKey, (old = []) =>
    old.some(r => r.id === row.id) ? old : [...old, row]
  )
})
```

Add a **`mobile_commands` subscription** so sent prompts stop depending on the global poll:

```tsx
.on('postgres_changes', {
  event: '*', schema: 'public', table: 'mobile_commands',
  filter: `session_id=eq.${sessionId}`,
}, (payload) => {
  const row = payload.new as MobileCommand
  qc.setQueryData<MobileCommand[]>(['prompts'], (old = []) => {
    const i = old.findIndex(c => c.id === row.id)
    if (i === -1) return [...old, row]
    const next = old.slice(); next[i] = { ...next[i], ...row }; return next
  })
})
```

Then the global `['prompts']` query can drop to `refetchInterval: 30_000` (or be scoped to
the session server-side — see Fix 5). **Net effect:** no more 5s re-measure storm, so the
list stops churning even before the scroll-gate fix — the two fixes compound.

### Fix 3 — Stop re-rendering every row

Wrap the row in `React.memo` and keep item objects referentially stable.

```tsx
const FeedRow = React.memo(function FeedRow({ item, onApprove, onDeny }: {...}) {
  ...
}, (prev, next) =>
  prev.item === next.item &&         // same object ref ⇒ skip re-render
  prev.onApprove === next.onApprove &&
  prev.onDeny === next.onDeny
)
```

`handleApprove` / `handleDeny` are already `useCallback`-stable (`ChatScreen.tsx:295-296`)
— good. To make `prev.item === next.item` actually hold across polls, dedupe stable rows in
the `useMemo` (reuse the previous object when `id` + relevant fields are unchanged). A
lightweight version: key a `Map` of previous items by `id` and reuse on rebuild. With
Realtime carrying updates and polling slowed to 30s, the rebuild frequency drops so far
that this is mostly belt-and-suspenders, but it makes scrolling through long histories
buttery.

### Fix 4 — FlatList virtualization tuning

```tsx
<FlatList
  ...
  windowSize={11}                 // default 21 — smaller = fewer mounted rows
  maxToRenderPerBatch={8}
  updateCellsBatchingPeriod={50}
  initialNumToRender={15}
  removeClippedSubviews            // Android win; test iOS
/>
```
Skip `getItemLayout` — bubble heights are variable (expandable text), so a fixed-height
layout function would be wrong. The window/batch props are the safe levers here.

### Fix 5 — Server: scope prompts by session (optional, removes the global fetch)

`fetchPrompts` pulls all prompts and the client filters by `session_id`
(`useChatFeed.ts:135-139`). Add a `session_id` query param to the `/mobile/prompts`
endpoint (or a `/mobile/sessions/:id/prompts` route) so the chat only fetches its own
session's prompts. Smaller payloads, less client work, and it pairs naturally with the
`mobile_commands` Realtime subscription from Fix 2.

### Fix 6 — Cheaper timestamps

`formatDistanceToNow` on every render adds up. Either memoize per item (recompute only when
`created_at` changes) or compute once when the row mounts and refresh on a single shared
60s interval rather than on every feed rebuild.

---

## 5. Windowed message loading — load recent, fetch older on scroll (WhatsApp / Telegram style)

WhatsApp and Telegram never load a whole conversation. They load the **most recent page**
(~30–50 messages), render instantly, and fetch **older** pages lazily when you scroll up.
New messages stream in at the bottom over the socket. This section explains how to bring
that model here — and why it's slightly harder for this app than for a normal chat.

### 5.1 What we do today (and why it doesn't scale)

The feed is built from three fetches in `useChatFeed.ts`:

| Source | Endpoint | Current cap | Problem |
|--------|----------|-------------|---------|
| `terminal_events` | `/mobile/terminal` | newest 60 (max 200), reversed | ✅ correct end, but **no "load older"** |
| `pending_requests` | `/mobile/sessions/:id/requests` | `ASC` + `.limit(100)` | ❌ returns the **oldest** 100 — on a long session, recent requests are silently dropped (`mobile.js:137,144`) |
| `mobile_commands` | `/mobile/prompts` | newest 20, **global** | ❌ all sessions, filtered client-side |

So there's no pagination at all — each source loads a fixed slab, and one of them loads
the *wrong* slab. For a short session this looks fine; for a long one it's both heavy
(parse + sort + render 100+ heterogeneous items at once) and **incorrect** (missing recent
approvals). Fix this and the chat opens faster *and* shows the right data.

### 5.2 The core challenge: this is a *merged* feed, not one stream

WhatsApp paginates one table (`messages`) ordered by time — a single cursor walks
backwards cleanly. Here the visible timeline is a **merge of three tables** sorted by
`created_at` (`useChatFeed.ts:119-142`). Naive per-source pagination breaks at the seams:
if you fetch "older terminal_events" and "older requests" independently with different page
sizes, their time ranges drift apart and you get **gaps or duplicates** at the boundary
between loaded pages.

There are two honest ways to solve this. They trade client complexity against a small
amount of server work.

### Option 1 — Unified server-side feed endpoint (RECOMMENDED)

Make the server do the merge once and expose **one** paginated, time-ordered stream.
Then the client is a plain reverse-infinite-scroll list — exactly the WhatsApp model.

Add `GET /mobile/sessions/:id/feed?before=<ISO ts>&limit=40` that `UNION ALL`s the three
tables into a single ordered, cursor-paginated result. Back it with a Postgres view or an
RPC so the union/order/limit happen in one indexed query:

```sql
-- A view that normalizes the three sources into one shape
create or replace view session_feed as
  select id, session_id, machine_id, user_id, created_at,
         'terminal'::text as source, to_jsonb(t.*) as payload
    from terminal_events t
  union all
  select id, session_id, machine_id, user_id, created_at,
         'request'::text  as source, to_jsonb(r.*) as payload
    from pending_requests r
  union all
  select id, session_id, machine_id, user_id, created_at,
         'prompt'::text   as source, to_jsonb(m.*) as payload
    from mobile_commands m;
```

```js
// GET /mobile/sessions/:sessionId/feed?before=<ts>&limit=40
router.get('/sessions/:sessionId/feed', requireMachineAuth, async (req, res) => {
  const limit  = Math.min(Number(req.query.limit) || 40, 100)
  const before = req.query.before // ISO timestamp cursor; absent = newest page
  let q = db.from('session_feed')
    .select('*')
    .eq('user_id', req.machine.user_id)
    .eq('session_id', req.params.sessionId)
    .order('created_at', { ascending: false })   // newest first
    .limit(limit)
  if (before) q = q.lt('created_at', before)      // strictly older than cursor
  const { data, error } = await q
  if (error) return res.status(500).json({ error: 'feed failed' })
  // hasMore = we filled the page; nextCursor = oldest row's created_at
  const rows = (data ?? []).reverse()             // return ascending for rendering
  res.json({
    items: rows,
    nextCursor: rows.length ? rows[0].created_at : null,
    hasMore: (data?.length ?? 0) === limit,
  })
})
```

- **Pros:** Client is trivial (one `useInfiniteQuery`, no cross-source merge, no boundary
  gaps). Correct by construction. Smallest payloads. Index `(session_id, created_at desc)`
  on each table and it's fast. Mirrors how real chat apps work.
- **Cons:** One new endpoint + a view/RPC. Cursor must tie-break on `id` when two rows
  share a timestamp (add `.order('id')` as a secondary key, and make the cursor
  `(created_at, id)`).
- **Effort:** ~1 day. **Risk:** low.

### Option 2 — Client-side paged merge (no server change)

Keep the three endpoints but add a `before` cursor to each, fetch one page of each per
"load older," and merge the union. To avoid gaps, **clamp every page to a shared time
window**: fetch `limit` of each source older than the cursor, then set the next cursor to
the **newest** `created_at` among the three returned slabs (not the oldest), so the next
round re-fetches any source that lagged behind. Drop anything already in the cache by `id`.

- **Pros:** No server work; reuses existing endpoints (after fixing the requests-ordering
  bug below).
- **Cons:** Real complexity — three cursors, window clamping, dedupe, and careful handling
  when one source is dense and another sparse. Easy to get subtly wrong. More requests per
  page (3× round-trips).
- **Effort:** ~2 days. **Risk:** medium. **Only choose this if you can't touch the server.**

### Decision

**Adopt Option 1.** A merged feed *wants* to be paginated server-side; doing it on the
client means re-deriving a SQL `UNION ALL ... ORDER BY ... LIMIT` by hand across three
network calls. The server endpoint is about a day of work and makes the client boring (the
goal).

### 5.3 Client implementation (reverse infinite scroll)

Swap the three polled queries in `useChatFeed.ts` for one `useInfiniteQuery` against the
feed endpoint:

```tsx
const feedQuery = useInfiniteQuery({
  queryKey: ['feed', sessionId],
  queryFn: ({ pageParam }) =>
    fetchSessionFeed(sessionId, { before: pageParam, limit: 40 }),
  initialPageParam: undefined as string | undefined,
  getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  staleTime: 10_000,
  refetchInterval: 30_000, // safety net; Realtime carries the live edge (see Fix 2)
})

// Flatten oldest→newest for rendering
const feed = useMemo(
  () => buildChatItems(feedQuery.data?.pages.flatMap(p => p.items) ?? []),
  [feedQuery.data],
)
```

Trigger "load older" when the user scrolls to the **top**:

```tsx
<FlatList
  ...
  onStartReached={() => feedQuery.hasNextPage && feedQuery.fetchNextPage()}
  onStartReachedThreshold={0.3}
  ListHeaderComponent={feedQuery.isFetchingNextPage ? <LoadingOlder /> : null}
  // CRITICAL: keep the viewport anchored when older rows are prepended,
  // otherwise loading a page yanks the list. Same prop that fixes the scroll bug.
  maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
/>
```

`maintainVisibleContentPosition` is what makes prepending older messages feel native — the
message you were reading stays exactly where it is while older content fills in above. This
is the same primitive recommended in **Fix 1**, so the scroll-bug fix and pagination share
one mechanism.

> **`inverted` becomes attractive here.** With pagination, an inverted FlatList maps "load
> older" onto the standard `onEndReached` (which, when inverted, is the top) and keeps the
> live edge pinned to the bottom with zero `scrollToEnd` calls. If you adopt pagination,
> re-evaluate `inverted` — it's a clean fit for a paginated chat, at the cost of flipping
> header/footer and reversing the data.

### 5.4 How pagination coexists with Realtime

The two are complementary and don't fight:

- **Live edge (bottom):** Realtime INSERTs append to the **last** page in the
  `useInfiniteQuery` cache (newest page). New agent output / requests / prompts appear at
  the bottom instantly — no poll needed.
- **History (top):** `fetchNextPage` pulls older pages on scroll-up. These are immutable
  history, so they never need Realtime.
- **Decisions:** a `pending_requests` UPDATE (approve/deny) may target a row on **any**
  loaded page — update it by `id` across all pages, not just the newest.
- Replace the crude `.slice(-200)` cap in the current Realtime handler
  (`useChatFeed.ts:88`) — with real pages you no longer need to hard-truncate; React Query
  manages the page list, and you can drop the oldest pages from memory if a session gets
  enormous.

### 5.5 Required server fixes regardless of option

- **Fix the requests ordering bug** (`mobile.js:137,144`): change to
  `.order('created_at', { ascending: false }).limit(...)` then `.reverse()` (mirror the
  terminal endpoint), so a long session shows the **recent** requests, not the oldest.
- **Add indexes** `(session_id, created_at desc)` on `terminal_events`,
  `pending_requests`, and `mobile_commands` so cursor pages stay fast as tables grow.
- **Scope prompts by session** (also Fix 5) so the prompt source isn't a global fetch.

### 5.6 Rollout order

1. Server: add indexes + fix the requests-ordering bug (safe, immediate correctness win).
2. Server: add the `session_feed` view + `/sessions/:id/feed` endpoint.
3. Client: replace the three queries with one `useInfiniteQuery`; wire `onStartReached` +
   `maintainVisibleContentPosition`.
4. Client: route Realtime INSERTs to the newest page; UPDATEs to the matching row on any
   page; delete the `.slice(-200)` cap.

---

## 6. Priority & expected impact

| # | Fix | Effort | Fixes the scroll bug? | Smoothness gain |
|---|-----|--------|-----------------------|-----------------|
| 1 | Conditional auto-scroll + `maintainVisibleContentPosition` | S | **Yes — directly** | High |
| 2 | Demote polling to 30s, lean on Realtime, insert-from-payload, add `mobile_commands` sub | S | Indirectly (removes churn) | High |
| 5 | **Windowed loading: unified `/feed` endpoint + reverse infinite scroll** | M–L | Indirectly (smaller initial render) | **High (long sessions)** |
| 3 | `React.memo` rows + stable item refs | M | No | Medium |
| 4 | FlatList virtualization props | S | No | Medium |
| — | Server: fix requests-ordering bug + add indexes (§5.5) | S | No | Correctness + speed |
| 6 | Memoized relative timestamps | S | No | Low |

**Do Fix 1 and Fix 2 first** — together they eliminate the reported scroll-jump and the
flicker in about half a day, with no architectural change. **Then do §5.5 (server bug +
indexes) and §5 windowed loading** — that's what makes long sessions open fast and load
older history on scroll like WhatsApp/Telegram. Fixes 3, 4, 6 are incremental polish.

---

## 7. What NOT to do (and why)

- **Don't build a custom Socket.io/ws server yet.** You'd re-implement auth, reconnection,
  fan-out, and horizontal scaling that Supabase Realtime already provides, and you'd turn a
  stateless API into a stateful one that fights PM2 cluster mode. Not justified at current
  scale. (See server `SCALING.md` for the connection-limit thresholds that *would* trigger
  this conversation.)
- **Don't just lower the poll interval to "fix lag."** Faster polling makes the scroll bug
  *worse* (more frequent re-measures) and drains battery. The websocket already gives you
  sub-second liveness — the poll should be slower, not faster.
- **Don't swap transports before fixing the scroll logic.** The jump-to-bottom bug is pure
  client logic; any transport with the current `onContentSizeChange` handler still jumps.
- **Don't paginate the three sources independently without clamping the window.** Merging
  separately-paged streams by timestamp creates gaps/duplicates at page boundaries. Either
  page server-side as one unified feed (§5, Option 1 — recommended) or clamp all sources to
  a shared time window per page (§5, Option 2). Don't hand-roll three drifting cursors.
- **Don't just raise the `limit` to "load more history."** Bigger slabs make the screen
  open slower and render-heavier — the opposite of WhatsApp's approach. The win is loading
  *less* up front (one recent page) and fetching older pages lazily on scroll.
```
