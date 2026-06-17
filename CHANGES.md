# Vibe Remote — Change Log

---

## Multi-harness support + WhatsApp-style chat UX

### What changed and why

---

### Problem summary

Four separate bugs were fixed in one pass:

| # | Problem | Root cause |
|---|---|---|
| 1 | Agent reasoning never appeared in the Terminal tab | `refetchInterval: 30_000` — too slow. Realtime also requires `terminal_events` to have publications enabled in self-hosted Supabase, which it didn't. |
| 2 | Same directory opened with Claude Code and OpenCode looked identical | Session card title was `machine_label` (hostname) for every session — no harness or directory info shown. |
| 3 | Chat history (approved/denied requests) was invisible | `/mobile/sessions/:id/requests` had `.eq('status', 'pending')` hardcoded — only live pending requests were ever returned. |
| 4 | OpenCode sessions never appeared in the sessions list | The OpenCode plugin never called `agent-ping`, so no `agents` row was created and the phone had nothing to show. |
| 5 | Fragmented UX | Reasoning was in the Terminal tab, approval cards in the Sessions tab, prompting was a separate modal — three places to look at once. |

---

### Server (`D:/Projects/vibe_remote(serverside)`)

#### `src/routes/mobile.js`

**`GET /mobile/sessions/:sessionId/requests`**

- Removed the hardcoded `.eq('status', 'pending')` filter.
- Now returns **all request statuses** (pending + approved + denied) ordered by `created_at asc`.
- Added optional `?pending=true` query param for callers that still want only pending (the Requests tab approval list uses this).
- Added `.limit(100)` to prevent unbounded queries.
- Also added `harness` field to the `/mobile/sessions` response and the `/mobile/command/next` response so the phone and heartbeat know which injection path to use.

#### `src/routes/relay.js`

- `POST /relay/agent-ping` — now stores `harness` on the `agents` row.
- `POST /relay/upload` — now stores `harness` on `pending_requests` rows.
- `POST /relay/terminal-event` — now stores `harness` on `terminal_events` rows.
- All three default to `'claude-code'` when the field is absent, so existing Claude Code traffic is unchanged.

#### `src/routes/harness.js` *(new)*

Four new endpoints for per-machine harness state:

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/harness/report` | machine key | Desktop pushes installed harness inventory + mobile_enabled state after every toggle and on launch |
| `GET` | `/harness/desired` | machine key | Desktop polls for phone-requested toggles |
| `GET` | `/harness/:machineId` | user JWT | Phone reads harness state for one of its machines |
| `POST` | `/harness/:machineId/desire` | user JWT | Phone requests a toggle; desktop applies within ~15s |

#### `src/index.js`

- Mounted `harnessRouter` at `/harness`.
- Added `import path` and `__dirname` shim (ESM).
- Added `GET /confirmed` route that serves `public/confirmed.html` (the post-email-confirmation landing page).

#### `migrations/003_multiharness.sql` *(new)*

Additive SQL migration — safe on a live database:

```sql
-- Adds harness column (default 'claude-code') to:
alter table pending_requests add column if not exists harness text not null default 'claude-code';
alter table agents          add column if not exists harness text not null default 'claude-code';
alter table terminal_events add column if not exists harness text not null default 'claude-code';

-- New table for per-machine, per-harness state:
create table if not exists machine_harnesses (
  machine_id      uuid references machines(id) on delete cascade,
  harness         text not null,
  display_name    text not null default '',
  installed       boolean not null default false,
  mobile_enabled  boolean not null default false,
  desired_enabled boolean,
  capabilities    jsonb not null default '{}'::jsonb,
  version         text,
  updated_at      timestamptz not null default now(),
  primary key (machine_id, harness)
);

-- Indexes on the three new harness columns.
```

Run on the VPS:
```bash
docker exec -i supabase-db-1 psql -U postgres -d postgres \
  < migrations/003_multiharness.sql
pm2 restart all
```

---

### Desktop daemon (`D:/Projects/vRdeksMultiharness/relay-deamon1`)

#### `src/harnesses/opencode/plugin/relay.js`

- Added `agentPing()` — called once per unique `sessionID` (tracked in `_pingedSessions` set).
- Fires `POST /relay/agent-ping` with `{ sessionId, cwd, harness: 'opencode' }` on the first gated tool call of each session.
- This creates the `agents` row that makes OpenCode sessions appear in the phone's Chats list.
- Non-fatal: if the ping fails the session just won't appear.

---

### Mobile app (`D:/Projects/vibe_remote(reactNative)/AgentControl`)

#### `src/types/index.ts`

- `ToolName` — expanded with canonical lower-case names (`bash`, `edit`, `write`, `patch`, `unknown`) so OpenCode/Gemini requests type-check correctly.
- `DisplayType` — added `'command'` for PTY-proxy tools.
- `HarnessId` — new open union type: `'claude-code' | 'opencode' | 'gemini-cli' | (string & {})`.
- `PendingRequest` — added `harness: HarnessId`.
- `AgentSession` — added `harness: HarnessId`.
- `TerminalEvent` — added `harness: HarnessId`.
- `HarnessCapabilities` + `MachineHarness` — new interfaces for the `/harness/:machineId` endpoint.
- `TabParamList` — removed `TerminalTab`, renamed `SessionsTab` → `ChatsTab`.
- `SessionsStackParamList` — replaced `SessionsList`/`SessionDetail`/`PromptCompose` with `ChatsList`/`Chat`. Added `prefill?: string` to `Chat` params for FileBrowser path injection.

#### `src/api/server.ts`

- Added `fetchSessionAllRequests(sessionId)` — calls `/mobile/sessions/:id/requests` (no `?pending=true`), returns all statuses. Used by the chat feed.
- `fetchSessionRequests` now appends `?pending=true` explicitly.
- Added `fetchHarnessState(machineId)` — user-authed `GET /harness/:machineId`.
- Added `desireHarnessToggle(machineId, harness, enabled)` — user-authed `POST /harness/:machineId/desire`.
- Both harness functions use a `userAuthHeader()` helper that lazy-loads the Supabase client for the JWT bearer token (harness routes are user-authed, not machine-key authed).

#### `src/hooks/useTerminal.ts`

- `refetchInterval` changed from `30_000` (30s) → **`5_000`** (5s) when a `sessionId` is provided.
- Global all-sessions view stays at 30s.
- Fetch limit raised from 60 → 120 events.
- This is the primary fix for reasoning not appearing — even without Realtime, new events now appear within 5s.

#### `src/hooks/useChatFeed.ts` *(new)*

Unified chronological feed for a single session. Merges:
- `terminal_events` where `event_type` is `output`, `notification`, or `stop`.
- `pending_requests` of all statuses.

`tool_start` and `tool_end` events are **excluded** — the request card already carries the same information with richer data (diff, approve/deny state).

Sorted by `created_at`. Realtime pushes both tables:
- `INSERT` on `terminal_events` → appended directly to the query cache.
- `INSERT`/`UPDATE` on `pending_requests` → invalidated / patched in place.

Also polls both at 5s as a Realtime fallback.

```ts
export type ChatItem =
  | { kind: 'output';  id: string; ts: string; event: TerminalEvent }
  | { kind: 'notify';  id: string; ts: string; event: TerminalEvent }
  | { kind: 'stop';    id: string; ts: string; event: TerminalEvent }
  | { kind: 'request'; id: string; ts: string; req:   PendingRequest }
```

#### `src/components/HarnessBadge.tsx` *(new)*

Small coloured pill:
- Claude Code → amber
- OpenCode → blue
- Gemini CLI → green
- Unknown harness → neutral grey

Two sizes: `sm` (default) and `xs`. Used in request cards, session cards, and the chat header.

#### `src/components/RequestCard.tsx`

- Imported `HarnessBadge`.
- Added harness badge to the meta row (right-aligned, `size="xs"`).
- Only shown when `harness !== 'claude-code'` so existing Claude requests look identical.

#### `src/screens/Sessions/SessionsScreen.tsx` → **Chats list**

Completely redesigned from a vertical card grid to a **WhatsApp-style flat list**:

- Each row: directory avatar (first letter of `dirName(cwd)`) with a status ring + online dot, `dirName(cwd)` title, `HarnessBadge`, status label, machine name, time-ago, pending-count badge.
- Two sessions in the same directory with different harnesses are now visually distinct — the harness badge differentiates them.
- Tapping a row navigates to `ChatScreen` instead of `SessionDetailScreen`.
- Header title changed from "Sessions" to "Chats".
- List style changed from padded card grid to edge-to-edge flat list with hairline dividers (matches WhatsApp).

#### `src/screens/Sessions/ChatScreen.tsx` *(new)*

Unified chat screen — replaces `SessionDetailScreen` + embedded Terminal tab.

**Layout:**
```
┌─────────────────────────────────────────┐
│ ←  DIRNAME   [Claude]  ·  machine       │  ← header
│              ~/full/path          [📁]  │
├─────────────────────────────────────────┤
│  ● Active                               │  ← status bar
├─────────────────────────────────────────┤
│  ╭──────────────────────────────────╮   │
│  │ I'll start by reading the tests… │   │  ← output bubble (agent reasoning)
│  │                        2m ago    │   │
│  ╰──────────────────────────────────╯   │
│                                         │
│  ── bash ──────────── [medium 🔶] ──    │
│  $ npm test                             │  ← inline request card
│  ┌─────────────┐  ┌─────────────────┐  │
│  │  ✗ Deny     │  │   ✓ Approve     │  │
│  └─────────────┘  └─────────────────┘  │
│                                         │
│  ── ✓ Task complete ─────── 5m ago ─── │  ← stop divider
│                                         │
├─────────────────────────────────────────┤
│  [  Send a prompt…            ]  [↑]   │  ← compose bar
└─────────────────────────────────────────┘
```

**Key behaviours:**
- Auto-scrolls to bottom when new items arrive.
- Compose bar is **disabled** (replaced by "N approvals pending above") when `pending_count > 0`.
- Compose bar is **disabled** when machine is offline or session is finished.
- Long reasoning blocks are truncated at 300 chars with a "Show more" toggle.
- Decided requests (approved/denied) show a coloured badge instead of action buttons.
- `prefill` param (set by FileBrowserScreen) pre-populates the compose bar via `useFocusEffect`.

#### `src/screens/Sessions/SessionDetailScreen.tsx` + `PromptComposeScreen.tsx`

Kept in the codebase but **no longer reachable from navigation**. Can be deleted in a future cleanup once confirmed unused.

#### `src/screens/Sessions/FileBrowserScreen.tsx`

- Long-press "Use in prompt" now navigates to `Chat` with `prefill: "Look at <path> and "` instead of the now-removed `PromptCompose` modal.

#### `src/screens/Machines/MachinesScreen.tsx`

- Added `HarnessPanel` component inside each machine card.
- Fetches `/harness/:machineId` (user-authed, 30s refetch).
- Shows one toggle row per **installed** harness with badge + version.
- Tapping a toggle calls `desireHarnessToggle` — the desktop applies within ~15s and reports back.
- Panel hidden when machine has no installed harnesses.
- Offline note shown when machine is offline ("toggles apply when it reconnects").

#### `src/navigation/RootNavigator.tsx`

- **`TerminalTab` removed.** Reasoning and tool activity now live inside `ChatScreen`.
- `SessionsTab` renamed → `ChatsTab` (icon: `chatbubbles`).
- `SessionsNavigator` replaced by `ChatsNavigator`: `ChatsList` → `Chat` → `RequestDetail` / `FileBrowser`.
- Tab bar badge on `ChatsTab` now shows the **total pending_count across all sessions** (not just active session count).

---

### How the fixes connect

```
User opens same dir in Claude + OpenCode
  ↓
agents table has two rows (different session_id, different harness column)
  ↓
/mobile/sessions returns both, each with harness field
  ↓
ChatsScreen shows two chat entries:
  "myproject  [Claude]  · LAPTOP"
  "myproject  [OpenCode] · LAPTOP"
  ↓
Tapping either opens ChatScreen for that session
  ↓
useChatFeed polls terminal_events + pending_requests every 5s
  ↓
Reasoning appears within 5s (was 30s or never)
  ↓
Decided requests appear in history (was filtered out before)
```

---

### Files created

| File | Location |
|---|---|
| `CHANGES.md` | `AgentControl/` |
| `src/hooks/useChatFeed.ts` | `AgentControl/src/hooks/` |
| `src/components/HarnessBadge.tsx` | `AgentControl/src/components/` |
| `src/screens/Sessions/ChatScreen.tsx` | `AgentControl/src/screens/Sessions/` |
| `src/routes/harness.js` | `vibe_remote(serverside)/src/routes/` |
| `migrations/003_multiharness.sql` | `vibe_remote(serverside)/migrations/` |
| `public/confirmed.html` | `vibe_remote(serverside)/public/` |

### Files modified

| File | What changed |
|---|---|
| `src/types/index.ts` | Added `HarnessId`, `HarnessCapabilities`, `MachineHarness`, `harness` fields, updated nav types |
| `src/api/server.ts` | Added `fetchSessionAllRequests`, `fetchHarnessState`, `desireHarnessToggle` |
| `src/hooks/useTerminal.ts` | Poll interval 30s → 5s per-session, limit 60 → 120 |
| `src/components/RequestCard.tsx` | Added `HarnessBadge` in meta row |
| `src/screens/Sessions/SessionsScreen.tsx` | Full redesign → WhatsApp chat list |
| `src/screens/Sessions/FileBrowserScreen.tsx` | "Use in prompt" → `navigate('Chat', { prefill })` |
| `src/screens/Machines/MachinesScreen.tsx` | Added `HarnessPanel` with per-harness toggles |
| `src/navigation/RootNavigator.tsx` | Removed `TerminalTab`, `SessionsTab` → `ChatsTab` |
| `src/routes/mobile.js` | Removed pending-only filter, added `harness` to responses |
| `src/routes/relay.js` | Thread `harness` through `agent-ping`, `upload`, `terminal-event` |
| `src/index.js` | Mount `harnessRouter`, add `/confirmed` route |
| `relay-deamon1/.env` | Moved to root (was in `src/`), added `API_URL` |
| `relay-deamon1/src/harnesses/opencode/plugin/relay.js` | Added `agentPing` on first tool call |
| `relay-deamon1/src/harness-sdk/transport.js` | `shell: true` on Windows for npm-global CLI detection |
