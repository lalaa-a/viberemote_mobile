# Vibe Remote — Full System Design

This document describes the complete target architecture covering the three projects:
- **Desktop** `D:\Projects\vibe_remote(dekstop)\my-app`
- **Server** `D:\Projects\vibe_remote(serverside)\src`
- **Mobile** `D:\Projects\vibe_remote(reactNative)\AgentControl\src`

---

## 1. Mental Model of the Hierarchy

```
User
 ├── Machine A  (DESKTOP-XYZ, Windows)
 │    ├── Agent / Session  aaa-111  (~/projects/api,  ACTIVE ● waiting for approval)
 │    │    ├── Pending request: Write src/index.ts  [needs approval]
 │    │    └── Pending request: Bash npm install    [needs approval]
 │    └── Agent / Session  bbb-222  (~/projects/web, IDLE ○ last active 4 min ago)
 │         └── (no pending requests)
 └── Machine B  (LAPTOP-DEF, macOS)
      └── Agent / Session  ccc-333  (~/work/backend, ACTIVE ● working)
           └── Pending request: Edit config.py  [needs approval]
```

Every **tool call** that Claude Code makes belongs to exactly one session. One session = one running `claude` CLI process. Multiple `claude` processes can run on the same machine (different terminals / projects). The session_id is provided by Claude Code in every hook event — it is already flowing through the system today but not surfaced in the mobile UI.

---

## 2. What Exists Today (Baseline)

### Database (Supabase)
| Table | What it stores | Gap |
|-------|---------------|-----|
| `machines` | machine registration, api_key_hash, is_online, last_seen | Complete |
| `agents` | session_id, machine_id, name, started_at | Rows never created; no status, no cwd, no last_activity |
| `pending_requests` | every tool call, session_id, diff, risk, status | session_id stored but not joined to agents; no agent_id |
| `push_tokens` | FCM tokens per machine/user | Complete |

### Desktop relay daemon
| File | Status |
|------|--------|
| `hook.js` | Intercepts tools, uploads requests — ✅ works |
| `heartbeat.js` | Pings /machines/heartbeat every 30s — ✅ works |
| `relay.cjs` | CLI control (approve/deny from terminal) — ✅ works |
| Agent tracking | ❌ not implemented — hook never creates/updates `agents` rows |
| Mobile prompt injection | ❌ not implemented |
| File tree serving | ❌ not implemented |

### Server
| Route group | Status |
|-------------|--------|
| `/machines` register, heartbeat, offline | ✅ works |
| `/relay` upload, decide, status | ✅ works |
| `/mobile` requests, decide, machines, history, push-token | ✅ works |
| Agent/session endpoints | ❌ missing |
| Prompt injection endpoints | ❌ missing |
| File tree endpoints | ❌ missing |

### Mobile
| Screen | Status |
|--------|--------|
| QR scan / auth | ✅ works |
| Requests list (all machines, polling 8s) | ✅ works |
| Request detail + approve/deny | ✅ works |
| Machines list + disconnect | ✅ works |
| History | ✅ works |
| Sessions view | ❌ missing |
| Prompt compose | ❌ missing |
| File browser | ❌ missing |

---

## 3. Target Architecture

### 3.1 Database additions

```sql
-- ── Extend agents table ────────────────────────────────────────────────────────
alter table agents
  add column if not exists status        text    not null default 'active',
  -- 'active' | 'idle' | 'finished'
  add column if not exists cwd           text,
  -- working directory at start of session
  add column if not exists last_activity_at timestamptz default now(),
  -- updated on every hook call for this session
  add column if not exists pending_count int     not null default 0;
  -- denormalized count; updated by trigger or server on upload/decide

-- ── Backfill unique constraint on session_id ──────────────────────────────────
alter table agents add constraint agents_session_id_unique unique (session_id);

-- ── Link pending_requests to agents ──────────────────────────────────────────
-- agent_id column already exists per schema, but FK may not be enforced yet
alter table pending_requests
  add column if not exists agent_id uuid references agents(id);

-- ── New: mobile prompt injection queue ───────────────────────────────────────
create table if not exists mobile_commands (
  id            uuid        primary key default gen_random_uuid(),
  machine_id    uuid        not null references machines(id) on delete cascade,
  session_id    text,
  -- null = deliver to whichever idle session of this machine heartbeat finds first
  user_id       uuid        not null references auth.users(id),
  prompt        text        not null,
  status        text        not null default 'pending',
  -- 'pending' | 'delivered' | 'cancelled'
  created_at    timestamptz not null default now(),
  delivered_at  timestamptz
);

-- ── New: file tree request/response ──────────────────────────────────────────
create table if not exists fs_requests (
  id            uuid        primary key default gen_random_uuid(),
  machine_id    uuid        not null references machines(id) on delete cascade,
  session_id    text,
  -- hint: which session's cwd to use as root
  path          text        not null default '.',
  status        text        not null default 'pending',
  -- 'pending' | 'ready' | 'error'
  result        jsonb,
  error         text,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

-- RLS policies (same pattern as existing tables)
alter table mobile_commands enable row level security;
create policy "users see own commands"
  on mobile_commands for all
  using (user_id = auth.uid());

alter table fs_requests enable row level security;
create policy "users see own fs requests"
  on fs_requests for all
  using (
    machine_id in (select id from machines where user_id = auth.uid())
  );
```

---

### 3.2 Session status derivation

A session's status is derived on the server when returning agent rows:

```
status = 'active'   if last_activity_at > now() - 30 seconds
status = 'idle'     if last_activity_at between 30s and 10 minutes ago
status = 'finished' if last_activity_at < now() - 10 minutes
```

`pending_count` is recomputed on every `/relay/upload` and `/mobile/decide` call so the mobile
always sees the right badge count per session without a separate query.

---

### 3.3 Data flow — full picture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DESKTOP                                                                  │
│                                                                          │
│  claude CLI  ──tool call──►  hook.js                                    │
│                               │                                          │
│                               ├── POST /relay/agent-ping   (upsert agent)│
│                               └── POST /relay/upload        (new request)│
│                                                                          │
│  heartbeat.js (every 30s) ──► POST /machines/heartbeat                  │
│               (every 10s) ──► GET  /mobile/command/next                 │
│                               └── if idle + prompt: spawn claude         │
│               (every 5s)  ──► GET  /machines/fs/pending                 │
│                               └── if pending: build tree + POST respond  │
└─────────────────────────────────────────────────────────────────────────┘
                    │ all calls via ngrok / VPS
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ SERVER (Express)                                                         │
│                                                                          │
│  /relay/agent-ping    upsert agents row, refresh last_activity_at        │
│  /relay/upload        insert pending_requests, bump agent pending_count  │
│  /relay/decide        update request status, decrement pending_count     │
│  /mobile/command/next claim oldest pending mobile_command for machine    │
│  /mobile/sessions     list agents + status for user's machines           │
│  /mobile/prompt       insert mobile_command row                          │
│  /mobile/fs/request   insert fs_request row                              │
│  /mobile/fs/result    return completed fs_request                        │
│  /machines/fs/pending return oldest pending fs_request for machine       │
│  /machines/fs/respond store tree result in fs_request                   │
└─────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ MOBILE (React Native)                                                    │
│                                                                          │
│  Sessions screen  ──polls /mobile/sessions (10s)──► list of agents     │
│  Session detail   ──polls /mobile/requests?session_id=X (8s)──► list   │
│  Prompt compose   ──POST /mobile/prompt──► queued for injection          │
│  File browser     ──POST /mobile/fs/request──► polls result──► tree UI  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Server Changes

### 4.1 New endpoints summary

```
RELAY (called by hook.js / heartbeat.js — machine API key auth)
─────────────────────────────────────────────────────────────────────────
POST /relay/agent-ping
  body:  { sessionId, cwd, toolName }
  → upsert agents(session_id, machine_id, cwd, last_activity_at)
  → returns { agentId }

GET  /mobile/command/next    ← called by heartbeat.js every 10s
  → SELECT + UPDATE (atomic): oldest pending mobile_command
    WHERE machine_id = req.machine.id
      AND agents.pending_count = 0
      AND agents.last_activity_at < now() - 30s   (Claude must be idle)
      AND (session_id IS NULL OR session_id = :target_session_id)
  → marks it 'delivered', returns { prompt, sessionId, sessionCwd } or null

GET  /machines/fs/pending
  → returns oldest pending fs_request for this machine (or null)

POST /machines/fs/respond
  body:  { requestId, tree } | { requestId, error }
  → UPDATE fs_requests set status='ready'|'error', result=tree, resolved_at=now()


MOBILE (called by mobile app — machine API key auth)
─────────────────────────────────────────────────────────────────────────
GET  /mobile/sessions
  → SELECT agents JOIN machines
    WHERE machines.user_id = req.machine.user_id
  → returns agents[] with derived status (active/idle/finished)
    and pending_count per session

GET  /mobile/sessions/:sessionId/requests
  → pending_requests for this session only
  → same shape as /mobile/requests

POST /mobile/prompt
  body:  { sessionId?, prompt }
  → INSERT mobile_commands
  → returns { id }

GET  /mobile/prompts
  → list mobile_commands for this machine (recent 20)
  → shows status (pending / delivered / cancelled)

DELETE /mobile/prompt/:id
  → UPDATE status='cancelled' if still pending

POST /mobile/fs/request
  body:  { path, sessionId? }
  → INSERT fs_requests
  → returns { requestId }

GET  /mobile/fs/result/:requestId
  → returns fs_request row (status + result tree if ready)
```

### 4.2 Changes to existing endpoints

**`POST /relay/upload`** — add agent_id resolution:
```js
// After requireMachineAuth:
// 1. Look up agent by session_id
const agent = await db.from('agents').select('id')
  .eq('session_id', payload.session_id).single()
// 2. Insert with agent_id
await db.from('pending_requests').insert({
  ...payload,
  agent_id: agent?.data?.id ?? null,
  machine_id: req.machine.id,
  user_id: req.machine.user_id,
})
// 3. Increment agent pending_count
if (agent?.data) {
  await db.from('agents')
    .update({ pending_count: db.rpc('increment', { row_id: agent.data.id }) })
}
```

**`POST /mobile/decide`** — decrement agent pending_count:
```js
// After updating pending_requests:
// Get agent_id from the request row, decrement its pending_count
```

---

## 5. Desktop Relay Daemon Changes

### 5.1 `hook.js` — only one addition: agent-ping

```js
// STEP 1: Upsert agent record (keeps last_activity_at fresh)
// This is the only hook.js change. Prompt delivery is NOT done here —
// it is handled exclusively by heartbeat.js when Claude is idle.
const agentPingRes = await fetch(`${config.apiUrl}/relay/agent-ping`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-machine-api-key': config.machineApiKey },
  body: JSON.stringify({
    sessionId: event.session_id,
    cwd: parsed.working_dir ?? process.cwd(),
    toolName: event.tool_name,
  }),
})
const { agentId } = await agentPingRes.json()

// STEP 2: Normal tool processing continues (filter, upload, wait for decision)...
```

### 5.2 `heartbeat.js` — add prompt delivery and file tree polling

```js
// Existing 30s heartbeat stays the same.
// Add prompt delivery (10s) and fs_requests (5s) loops:

setInterval(checkPendingCommands, 10_000)  // prompt delivery — see section 7
setInterval(checkFsRequests, 5_000)        // file tree

// ── File tree ──────────────────────────────────────────────────────────────

async function checkFsRequests() {
  const res = await fetch(`${config.apiUrl}/machines/fs/pending`, {
    headers: { 'x-machine-api-key': config.machineApiKey }
  })
  if (!res.ok) return
  const pending = await res.json()
  if (!pending?.id) return

  try {
    const root = pending.sessionCwd ?? process.cwd()
    const tree = buildTree(root, pending.path, root, 4)
    await fetch(`${config.apiUrl}/machines/fs/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-machine-api-key': config.machineApiKey },
      body: JSON.stringify({ requestId: pending.id, tree }),
    })
  } catch (err) {
    await fetch(`${config.apiUrl}/machines/fs/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-machine-api-key': config.machineApiKey },
      body: JSON.stringify({ requestId: pending.id, error: err.message }),
    })
  }
}

function buildTree(absoluteRoot, requestedPath, baseCwd, maxDepth, depth = 0) {
  const fullPath = path.resolve(absoluteRoot, requestedPath)

  // Security: never escape the machine's cwd
  if (!fullPath.startsWith(baseCwd)) throw new Error('Path traversal blocked')

  const SKIP = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.venv', 'build'])

  const entries = fs.readdirSync(fullPath, { withFileTypes: true })
    .filter(e => !SKIP.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      // Dirs first
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  return entries.map(entry => {
    const childRelPath = path.join(requestedPath, entry.name)
    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path: childRelPath,
        type: 'dir',
        // null means "has children, not loaded yet" → mobile can request this path lazily
        children: depth < maxDepth
          ? buildTree(absoluteRoot, childRelPath, baseCwd, maxDepth, depth + 1)
          : null,
      }
    }
    const stat = fs.statSync(path.join(fullPath, entry.name))
    return { name: entry.name, path: childRelPath, type: 'file', size: stat.size }
  })
}

```

---

## 6. Mobile App Changes

### 6.1 New navigation structure

```
Tab bar
├── Requests   ⊡   (existing, unchanged — all pending across all sessions)
├── Sessions   ⚡  (new)
├── Machines   ◈   (existing)
└── History    ◷   (existing)
```

The **Sessions tab** is the main new surface. Requests tab stays for quick "anything pending?" view.

### 6.2 New screens

#### SessionsScreen
Lists every agent across all user's machines.

```
┌─────────────────────────────────────────────────┐
│ Sessions                                   2 active │
│─────────────────────────────────────────────────│
│ ● DESKTOP-XYZ                                   │
│   ~/projects/api                                │
│   ■■ 2 pending · Active                         │
│                                    [Prompt] [→] │
│─────────────────────────────────────────────────│
│ ○ DESKTOP-XYZ                                   │
│   ~/projects/web                                │
│   Idle · 4 min ago                              │
│                                    [Prompt] [→] │
│─────────────────────────────────────────────────│
│ ● LAPTOP-DEF                                    │
│   ~/work/backend                                │
│   ■ 1 pending · Active                          │
│                                    [Prompt] [→] │
└─────────────────────────────────────────────────┘
```

Status dots: green ● = active/waiting, yellow ◐ = idle, grey ○ = finished

Data: `GET /mobile/sessions` (polls every 10s)

#### SessionDetailScreen
Reached by tapping `→` on a session card.

```
┌─────────────────────────────────────────────────┐
│ ← ~/projects/api                   ● Active     │
│   DESKTOP-XYZ · Session aaa-111                 │
│─────────────────────────────────────────────────│
│ [Browse files]                    [Send prompt] │
│─────────────────────────────────────────────────│
│ PENDING REQUESTS (2)                            │
│  [Write src/index.ts  HIGH  !!  →]              │
│  [Bash npm install    MED   !   →]              │
│─────────────────────────────────────────────────│
│ SENT PROMPTS                                    │
│  ✓ "Run the tests"   delivered  2 min ago       │
│  ⏳ "Check config"   pending                    │
└─────────────────────────────────────────────────┘
```

Requests navigate to the existing RequestDetailScreen (no changes needed there).

#### PromptComposeScreen (modal / bottom sheet)
Triggered by [Send prompt] button on session detail.

```
┌─────────────────────────────────────────────────┐
│  Send prompt to ~/projects/api                  │
│─────────────────────────────────────────────────│
│ ┌───────────────────────────────────────────┐   │
│ │ Run the test suite and fix any failures   │   │
│ │                                           │   │
│ └───────────────────────────────────────────┘   │
│                                                 │
│  ⚠️  Delivered when Claude is idle and has no    │
│     pending approvals. Checked every 10 seconds. │
│                                                 │
│                              [Cancel]  [Send →] │
└─────────────────────────────────────────────────┘
```

POST `/mobile/prompt` with `{ sessionId, prompt }`.

#### FileBrowserScreen
Triggered by [Browse files] on session detail.

```
┌─────────────────────────────────────────────────┐
│ ← Files · ~/projects/api                        │
│─────────────────────────────────────────────────│
│ 📁 src              ▶                           │
│   📁 api            ▶                           │
│   📁 hooks          ▶                           │
│   📄 index.ts       2.1 KB                      │
│   📄 server.ts      4.8 KB                      │
│ 📁 android          ▶                           │
│ 📁 ios              ▶                           │
│ 📄 package.json     1.2 KB                      │
│ 📄 tsconfig.json    0.6 KB                      │
│─────────────────────────────────────────────────│
│ Long-press a path → copy · Use in prompt        │
└─────────────────────────────────────────────────┘
```

Flow:
1. Screen opens → POST `/mobile/fs/request { path: ".", sessionId }`
2. Poll `/mobile/fs/result/:id` every 2s until status = ready
3. Render tree. Tap directory → POST `/mobile/fs/request { path: "src", sessionId }` for that subtree (lazy loading)
4. Long-press file → action sheet: "Copy path" | "Use in prompt"
   - "Use in prompt" opens PromptComposeScreen pre-filled with: `"Look at src/index.ts and..."`

---

### 6.3 New types

```typescript
export type SessionStatus = 'active' | 'idle' | 'finished'

export interface AgentSession {
  id:               string
  machine_id:       string
  machine_label:    string
  session_id:       string
  cwd:              string | null
  status:           SessionStatus
  pending_count:    number
  last_activity_at: string
  started_at:       string
}

export interface MobileCommand {
  id:           string
  session_id:   string | null
  prompt:       string
  status:       'pending' | 'delivered' | 'cancelled'
  created_at:   string
  delivered_at: string | null
}

export interface FsNode {
  name:      string
  path:      string
  type:      'file' | 'dir'
  size?:     number          // files only
  children?: FsNode[] | null // null = not yet loaded
}

// Navigation additions
export type TabParamList = {
  RequestsTab:  undefined
  SessionsTab:  undefined
  MachinesTab:  undefined
  HistoryTab:   undefined
}

export type SessionsStackParamList = {
  SessionsList:   undefined
  SessionDetail:  { sessionId: string; machineLabel: string; cwd: string | null }
  FileBrowser:    { sessionId: string; machineLabel: string }
  PromptCompose:  { sessionId: string; prefill?: string }
}
```

### 6.4 New API functions (add to `server.ts`)

```typescript
// Sessions
export function fetchSessions(): Promise<AgentSession[]> {
  return request('/mobile/sessions')
}

export function fetchSessionRequests(sessionId: string): Promise<PendingRequest[]> {
  return request(`/mobile/sessions/${encodeURIComponent(sessionId)}/requests`)
}

// Prompts
export function sendPrompt(prompt: string, sessionId?: string): Promise<{ id: string }> {
  return request('/mobile/prompt', {
    method: 'POST',
    body: JSON.stringify({ prompt, sessionId }),
  })
}

export function fetchPrompts(): Promise<MobileCommand[]> {
  return request('/mobile/prompts')
}

export function cancelPrompt(id: string): Promise<void> {
  return request(`/mobile/prompt/${id}`, { method: 'DELETE' })
}

// File tree
export function requestFileTree(path: string, sessionId?: string): Promise<{ requestId: string }> {
  return request('/mobile/fs/request', {
    method: 'POST',
    body: JSON.stringify({ path, sessionId }),
  })
}

export function pollFileTreeResult(requestId: string): Promise<{
  status: 'pending' | 'ready' | 'error'
  result?: FsNode[]
  error?: string
}> {
  return request(`/mobile/fs/result/${requestId}`)
}
```

### 6.5 New hooks

```typescript
// useSession.ts
export function useSessions() {
  return useQuery({
    queryKey:        ['sessions'],
    queryFn:         fetchSessions,
    refetchInterval: 10_000,
  })
}

export function useSessionRequests(sessionId: string) {
  return useQuery({
    queryKey:        ['sessions', sessionId, 'requests'],
    queryFn:         () => fetchSessionRequests(sessionId),
    refetchInterval: 8_000,
  })
}

// useFileTree.ts
export function useFileTree(sessionId: string) {
  const [requestId, setRequestId] = useState<string | null>(null)
  const [tree, setTree] = useState<FsNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadPath(path: string) {
    const { requestId: id } = await requestFileTree(path, sessionId)
    setRequestId(id)
  }

  useQuery({
    queryKey:        ['fs', requestId],
    queryFn:         () => pollFileTreeResult(requestId!),
    enabled:         !!requestId,
    refetchInterval: (data) => data?.status === 'pending' ? 2_000 : false,
    onSuccess: (data) => {
      if (data.status === 'ready') { setTree(data.result!); setRequestId(null) }
      if (data.status === 'error') { setError(data.error!); setRequestId(null) }
    },
  })

  return { tree, error, loadPath, loading: !!requestId }
}
```

---

## 7. When mobile prompts can be sent and delivered

### The rule

> **The mobile "Send prompt" button is only enabled when the session has `pending_count === 0`.**
> Prompts are only delivered by the heartbeat when `pending_count === 0` AND `last_activity_at > 30s ago`.

This prevents the mobile user from interrupting Claude mid-task.

### Full state matrix

| Session state | pending_count | Send button | What happens |
|---|---|---|---|
| **Mid-task, waiting for approvals** | > 0 | ❌ Disabled | Nothing. Approve/deny requests as normal. |
| **Task finished, Claude idle at terminal** | 0, last_activity > 30s | ✅ Enabled | Heartbeat detects idle + pending command → spawns `claude --resume -p "prompt"` → delivered. |
| **Session finished** (process exited) | 0, last_activity > 10 min | ✅ Enabled (with warning) | Heartbeat spawns `claude --resume -p "prompt"` — still works because `--resume` loads saved conversation history even if original process is gone. |

### Why disabling during pending_count > 0 is correct

If Claude is waiting for request approval and the user sends a new prompt:
- The prompt would be injected on the NEXT tool call
- But that next tool call might be in the middle of the same task (e.g. Claude chains Bash → Write → Edit)
- Injecting there would **abandon the in-progress task** and confuse Claude

So: wait until the task is fully done (all requests decided, pending_count back to 0), then the mobile user can issue the next instruction.

### Mobile UI enforcement

```typescript
// In SessionDetailScreen:
const canSendPrompt = session.pending_count === 0

// Prompt button:
<TouchableOpacity
  style={[styles.promptBtn, !canSendPrompt && styles.disabled]}
  disabled={!canSendPrompt}
  onPress={openPromptCompose}
>
  <Text>{canSendPrompt ? 'Send prompt' : 'Waiting for approvals…'}</Text>
</TouchableOpacity>
```

The button text changes to **"Waiting for approvals…"** when disabled so the user understands why.

### One delivery path — heartbeat only

Prompts are **never injected mid-task via the hook**. The single delivery mechanism is the heartbeat process, which runs every 10s and checks whether Claude is idle before delivering.

```
mobile sends prompt
  → stored in mobile_commands with status 'pending'
  → heartbeat polls every 10s
  → conditions met: pending_count === 0 AND last_activity_at > 30s ago
  → heartbeat spawns: claude --resume <session_id> -p "prompt" (in session's cwd)
  → Claude loads full conversation history, processes the prompt
  → makes tool calls → hook.js fires → mobile approves as usual ✓
```

```js
// heartbeat.js — prompt delivery loop
async function checkPendingCommands() {
  const res = await fetch(`${config.apiUrl}/mobile/command/next`, {
    headers: { 'x-machine-api-key': config.machineApiKey }
  })
  const cmd = res.ok ? await res.json() : null
  if (!cmd?.prompt) return

  // Spawn claude non-interactively, resuming the exact conversation
  const child = spawn('claude', ['--resume', cmd.sessionId, '-p', cmd.prompt], {
    cwd:   cmd.sessionCwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env:   { ...process.env },
  })

  child.on('error', (err) => {
    console.error('[heartbeat] spawn failed:', err.message)
    // Server already marked delivered — log only, don't re-queue
  })
}

setInterval(checkPendingCommands, 10_000)
```

`claude --resume <session_id> -p "prompt"` resumes the conversation with its full history and sends the mobile message as the next user turn. Any tool calls trigger `hook.js` as normal — mobile approves them as usual.

The original idle `claude` session in the terminal becomes stale once the heartbeat spawns a new process. The desktop user should close it.

#### Server: `/mobile/command/next` only returns when idle

```js
GET /mobile/command/next

// Server logic:
// 1. Find oldest pending mobile_command for this machine
// 2. Check agents.last_activity_at < now() - 30s  (Claude must be idle)
//    AND agents.pending_count === 0               (no outstanding approvals)
// 3. If conditions not met → return null (nothing to deliver yet)
// 4. Atomically mark command as 'delivered', return { prompt, sessionId, sessionCwd }
```

The 30s idle check ensures the heartbeat never delivers a prompt while Claude is actively working (fast sequential tool calls can have brief moments of `pending_count === 0` between approvals).

#### Prompt status the user sees

```
⏳ Pending      — queued, Claude still working or too recent to deliver
✓  Delivered    — heartbeat spawned claude, prompt is in the conversation
✗  Cancelled    — user cancelled before delivery
```

---

## 8. Security constraints

| Concern | Mitigation |
|---|---|
| Path traversal in file browser | `buildTree` resolves the requested path and checks it starts with the session's `cwd`. Any path outside is rejected with HTTP 403. |
| Prompt injection running arbitrary shell commands | Prompts are injected as Claude's *conversation input*, not as shell commands. Claude still has to decide what to do, and the hook will still intercept any resulting tool calls for approval. |
| Cross-machine access | All `/mobile/*` endpoints derive the user from the machine API key. `mobile_commands` and `fs_requests` are keyed by `machine_id`, which is validated server-side. |
| Overly large file trees | `buildTree` limits depth to 4 levels and skips `node_modules`, `.git`, `dist`. Result is stored in Supabase `jsonb` (max ~1MB per row is safe). |
| Stale pending commands | A `mobile_command` targeted at a specific `session_id` is only delivered to that session. If the session ends, the command stays `pending`. A server cron can expire commands older than 24h. |

---

## 9. Implementation order

Build in this order — each step is independently shippable:

| # | Change | Projects touched | Depends on |
|---|--------|-----------------|-----------|
| 1 | DB migrations (agents extend, mobile_commands, fs_requests) | DB | — |
| 2 | `POST /relay/agent-ping` endpoint | Server | 1 |
| 3 | hook.js calls agent-ping on every tool call | Desktop | 2 |
| 4 | `GET /mobile/sessions` endpoint | Server | 1, 2 |
| 5 | Sessions screen + session detail on mobile | Mobile | 4 |
| 6 | `POST /mobile/prompt` + `GET /mobile/command/next` (idle-gated) | Server | 1 |
| 7 | heartbeat.js polls `/mobile/command/next` and spawns `claude --resume -p` | Desktop | 6 |
| 8 | Prompt compose screen on mobile | Mobile | 6 |
| 9 | `/machines/fs/pending` + `/machines/fs/respond` + `/mobile/fs/*` | Server | 1 |
| 10 | heartbeat.js polls and responds to fs requests | Desktop | 9 |
| 11 | File browser screen on mobile | Mobile | 9 |
| 12 | "Use in prompt" wires file browser → prompt compose | Mobile | 8, 11 |
