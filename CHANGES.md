# Vibe Remote — Implementation Changes

Based on `FULL_SYSTEM_DESIGN.md`. All 12 steps from §9 implemented across three projects.

---

## Database (Supabase)

### Step 1 — Migrations

**Extend `agents` table** (4 new columns):
```sql
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS status           text        NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cwd              text,
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pending_count    int         NOT NULL DEFAULT 0;
```

**New table: `mobile_commands`**
```sql
CREATE TABLE IF NOT EXISTS public.mobile_commands (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id   uuid        NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  session_id   text,
  user_id      uuid        NOT NULL REFERENCES auth.users(id),
  prompt       text        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
ALTER TABLE public.mobile_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own commands" ON public.mobile_commands FOR ALL
  USING (user_id = auth.uid());
```

**New table: `fs_requests`**
```sql
CREATE TABLE IF NOT EXISTS public.fs_requests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id  uuid        NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  session_id  text,
  path        text        NOT NULL DEFAULT '.',
  status      text        NOT NULL DEFAULT 'pending',
  result      jsonb,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE public.fs_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own fs requests" ON public.fs_requests FOR ALL
  USING (machine_id IN (SELECT id FROM public.machines WHERE user_id = auth.uid()));
```

> Already present (no migration needed): `agents.session_id` UNIQUE constraint, `pending_requests.agent_id` FK.

---

## Desktop — `D:\Projects\vibe_remote(dekstop)\my-app\relay-deamon1`

### Step 3 — `hook.js`

**Added** `agentPing` to imports from `./src/supabase.js`.

**Added** agent-ping call after `parseEvent`, before `uploadRequest`:
```js
try {
  await agentPing(
    event.session_id,
    parsed.working_dir ?? process.cwd(),
    event.tool_name,
  )
} catch (err) {
  debugLog(`agent-ping failed: ${err.message}`)
}
```
Failures are silently logged — they never block a tool call.

---

### Steps 7 & 10 — `scripts/heartbeat.js`

Rewrote from single-loop to three loops:

| Loop | Interval | What it does |
|---|---|---|
| `tick` | 30s | Machine heartbeat — unchanged |
| `checkPendingCommands` | 10s | Polls `GET /mobile/command/next`. If server returns a command (only when session is idle), spawns `claude --resume <sessionId> -p "prompt"` in the session's cwd |
| `checkFsRequests` | 5s | Polls `GET /machines/fs/pending`. If a request exists, runs `buildTree` and POSTs result to `/machines/fs/respond` |

**Added** `buildTree(absoluteRoot, requestedPath, baseCwd, maxDepth, depth)`:
- Depth limit: 4 levels
- Skips: `node_modules`, `.git`, `dist`, `.next`, `__pycache__`, `.venv`, `build`, dotfiles
- Security: path traversal blocked — rejects any path that escapes the session's cwd
- Dirs first, alphabetical sort within each type

---

### `src/supabase.js`

Added `apiGet` (private GET helper) and four new exported functions:

| Export | Endpoint |
|---|---|
| `agentPing(sessionId, cwd, toolName)` | `POST /relay/agent-ping` |
| `getNextCommand()` | `GET /mobile/command/next` |
| `getPendingFsRequest()` | `GET /machines/fs/pending` |
| `respondFsRequest(requestId, treeOrError)` | `POST /machines/fs/respond` |

---

## Server — `D:\Projects\vibe_remote(serverside)\src`

### New file: `src/utils.js`

| Export | Purpose |
|---|---|
| `syncAgentPendingCount(agentId)` | Recomputes `pending_count` from actual pending rows. Called after every upload and decide. |
| `deriveStatus(lastActivityAt)` | Returns `'active'` / `'idle'` / `'finished'` from timestamp. Never stored — always computed at query time. |

Status thresholds:
- **active**: `last_activity_at > now() - 30s`
- **idle**: `last_activity_at` between 30s and 10 min ago
- **finished**: `last_activity_at < now() - 10 min`

---

### Steps 2 & 4 — `src/routes/relay.js`

#### New: `POST /relay/agent-ping`
- Upserts `agents` row on every hook call
- Sets `session_id`, `machine_id`, `cwd`, `last_activity_at`
- Returns `{ agentId }`

#### Updated: `POST /relay/upload`
- Resolves `agent_id` from `session_id` before insert
- Inserts `pending_requests` with `agent_id` linked
- Calls `syncAgentPendingCount(agentId)` after insert

#### Updated: `POST /relay/decide`
- Fetches `agent_id` from the request row first
- Updates request status as before
- Calls `syncAgentPendingCount(agentId)` after update

---

### `src/routes/mobile.js`

#### New endpoints

| Endpoint | Description |
|---|---|
| `GET /mobile/sessions` | All sessions across all user machines. Fetches machine IDs first, then agents. Applies `deriveStatus` on each row. Returns `AgentSession[]`. |
| `GET /mobile/sessions/:sessionId/requests` | Pending requests for one session. Scoped to user's machines. |
| `POST /mobile/prompt` | Queues a prompt. Resolves target `machine_id` from `session_id` (target machine may differ from calling machine). |
| `GET /mobile/prompts` | Last 20 `mobile_commands` for the user (all machines). |
| `DELETE /mobile/prompt/:id` | Sets status to `'cancelled'` if still `'pending'`. |
| `GET /mobile/command/next` | Idle-gated delivery. Returns oldest pending command only when `pending_count = 0` AND `last_activity_at > 30s ago`. Atomically marks `'delivered'` (optimistic lock prevents double-delivery). Returns `{ prompt, sessionId, sessionCwd }` or `null`. |
| `POST /mobile/fs/request` | Inserts `fs_requests`. Resolves target machine from `session_id`. Returns `{ requestId }`. |
| `GET /mobile/fs/result/:requestId` | Polls `fs_requests` row. Ownership-checked via user's machines. Returns `{ status, result?, error? }`. |

#### Updated: `POST /mobile/decide`
- Fetches `agent_id` before updating request status
- Calls `syncAgentPendingCount(agentId)` after update

---

### `src/routes/machines.js`

#### New: `GET /machines/fs/pending`
- Returns oldest `'pending'` `fs_requests` row for this machine
- Attaches `sessionCwd` from `agents` table if `session_id` is set
- Returns `null` if nothing pending

#### New: `POST /machines/fs/respond`
- Stores completed tree or error back into `fs_requests`
- Sets `status = 'ready'` or `'error'`, `resolved_at = now()`

---

## Mobile — `D:\Projects\vibe_remote(reactNative)\AgentControl\src`

### Steps 5, 8, 11, 12 — all mobile changes

#### `src/types/index.ts`

Added types:
```typescript
type SessionStatus = 'active' | 'idle' | 'finished'

interface AgentSession {
  id, machine_id, machine_label, session_id,
  cwd, status, pending_count, last_activity_at, started_at
}

interface MobileCommand {
  id, session_id, prompt,
  status: 'pending' | 'delivered' | 'cancelled',
  created_at, delivered_at
}

interface FsNode {
  name, path, type: 'file' | 'dir',
  size?,           // files only
  children?        // null = not yet loaded (depth > 4)
}
```

Updated navigation types:
```typescript
// TabParamList — added SessionsTab
type TabParamList = {
  RequestsTab, SessionsTab, MachinesTab, HistoryTab
}

// New
type SessionsStackParamList = {
  SessionsList:  undefined
  SessionDetail: { sessionId, machineLabel, cwd }
  RequestDetail: { id }
  FileBrowser:   { sessionId, machineLabel, cwd }
  PromptCompose: { sessionId, prefill? }
}
```

---

#### `src/api/server.ts`

Added 7 functions:

| Function | Endpoint |
|---|---|
| `fetchSessions()` | `GET /mobile/sessions` |
| `fetchSessionRequests(sessionId)` | `GET /mobile/sessions/:sessionId/requests` |
| `sendPrompt(prompt, sessionId?)` | `POST /mobile/prompt` |
| `fetchPrompts()` | `GET /mobile/prompts` |
| `cancelPrompt(id)` | `DELETE /mobile/prompt/:id` |
| `requestFileTree(path, sessionId?)` | `POST /mobile/fs/request` |
| `pollFileTreeResult(requestId)` | `GET /mobile/fs/result/:requestId` |

---

#### `src/hooks/useSessions.ts` *(new)*

| Hook / mutation | Poll interval |
|---|---|
| `useSessions()` | 10s |
| `useSessionRequests(sessionId)` | 8s |
| `usePrompts()` | 10s |
| `useSendPrompt()` | mutation, invalidates `['prompts']` |
| `useCancelPrompt()` | mutation, invalidates `['prompts']` |

---

#### `src/hooks/useFileTree.ts` *(new)*

Manages the request → poll → result cycle.

- `loadPath(path)` — posts a new `fs_request`, sets `requestId` state
- React Query polls `/mobile/fs/result/:id` every 2s while `status = 'pending'`
- `useEffect` on `data` handles `ready` / `error` (RQ v5 compatible — no `onSuccess`)
- `refetchInterval` stops automatically once result is final
- Returns `{ tree, error, loadPath, loading }`

---

#### `src/screens/Sessions/SessionsScreen.tsx` *(new)*

- Lists all sessions, sorted by `last_activity_at` desc
- Status dot: green (active), yellow (idle), grey (finished)
- Active session count badge on Sessions tab
- **Prompt** button: disabled + label changes to `"Approvals pending…"` when `pending_count > 0`
- **Detail →** navigates to `SessionDetail`

---

#### `src/screens/Sessions/SessionDetailScreen.tsx` *(new)*

- Header: cwd (monospace) + machine label + Files / Prompt action buttons
- `SectionList` with two sections:
  - **Pending Requests** — from `useSessionRequests`, taps into `RequestDetailScreen`
  - **Sent Prompts** — from `usePrompts` filtered by `session_id`, with status icon and cancel button

---

#### `src/screens/Sessions/PromptComposeScreen.tsx` *(new)*

- Modal bottom-sheet (`presentation: 'modal'`)
- Multiline `TextInput`, 2000 char limit with counter
- Supports `prefill` param (used by "Use in prompt" from FileBrowser)
- Send button disabled when input is empty or request is in-flight
- Closes on successful send

---

#### `src/screens/Sessions/FileBrowserScreen.tsx` *(new)*

- On mount: `loadPath('.')` — fetches full tree (4 levels deep from desktop)
- Top-level dirs auto-expanded on first load
- Renders flat list with depth-based indentation via `flattenTree`
- Folders with loaded children: tap to expand/collapse (local state)
- Folders with `children: null` (depth > 4): tap triggers new `loadPath` request
- Long-press any item → Alert with **"Use in prompt"** → navigates to `PromptCompose` prefilled with the path

---

#### `src/navigation/RootNavigator.tsx` *(updated)*

- Added `SessionsNavigator` stack (5 screens: `SessionsList`, `SessionDetail`, `RequestDetail`, `FileBrowser`, `PromptCompose`)
- `PromptCompose` uses `presentation: 'modal'`
- `RequestDetailScreen` reused in sessions stack (only calls `navigation.goBack()` — no stack-specific navigation)
- Added `SessionsTab` to tab bar with `⚡` icon
- Sessions tab shows a **green badge** with the count of active sessions
- `useSessions` polled in `AppNavigator` for the badge count

---

## Prompt delivery rule (summary)

```
Mobile sends prompt
  → stored in mobile_commands (status: 'pending')
  → heartbeat polls GET /mobile/command/next every 10s
  → server checks: pending_count === 0 AND last_activity_at > 30s ago
  → if idle: marks 'delivered', returns { prompt, sessionId, sessionCwd }
  → heartbeat spawns: claude --resume <sessionId> -p "prompt"
  → Claude resumes full conversation history
  → tool calls trigger hook.js → mobile approves as usual
```

Mobile "Prompt" button is **disabled** when `session.pending_count > 0`.
