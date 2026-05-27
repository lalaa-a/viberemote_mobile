# Vibe Remote — Improvements Implementation Plan

This document is a self-contained implementation guide for three improvements derived from the SSH/tmux analysis. Aimed at being executed by Claude Sonnet 4.6. Each phase is independent; do them in order but each can ship separately.

**Codebase paths:**
- Mobile: `D:\Projects\vibe_remote(reactNative)\AgentControl`
- Desktop: `D:\Projects\vibe_remote(dekstop)\my-app`
- Server: `D:\Projects\vibe_remote(serverside)`

---

## PHASE 1 — Supabase Realtime on `terminal_events`

**Goal:** Replace the 5s polling on the Terminal tab with live push updates. Polling continues at 30s as a safety net.

**Why this approach (and not SSE):** The desktop side already uses Supabase Realtime for the `pending_requests` decision channel. Same pattern, same infra, no new transport to maintain. Polling fallback stays because Realtime can silently drop events.

### 1a. Verify Realtime is enabled on the table

In Supabase SQL editor, run:

```sql
alter publication supabase_realtime add table terminal_events;
```

If it errors with "already exists", you're done — skip.

### 1b. Decide on the auth model — pick ONE

Mobile currently authenticates to **our server** via the `x-machine-api-key` header. Supabase Realtime needs **Supabase auth** (JWT or anon key). Two options:

#### Option A — Mint a JWT server-side (recommended, secure)

Pros: proper per-user isolation, existing RLS policies work as-is.
Cons: one new endpoint, slight complexity.

Implementation in Phase 1d below.

#### Option B — Add Supabase anon key to QR + permissive RLS (faster, less secure)

Pros: trivial to implement.
Cons: anyone with the anon key can read all `terminal_events` rows (the anon key is technically public-safe, but you lose per-user RLS).

If you go with B, skip 1d and just add `supabaseKey` to the `QRPayload` type and `MachineCredentials` storage. Then change the policy:

```sql
drop policy "user reads own events" on terminal_events;
create policy "anon can read terminal_events" on terminal_events for select using (true);
```

**Go with Option A.** The rest of this doc assumes A.

### 1c. Add `SUPABASE_JWT_SECRET` to server env

The server needs to sign JWTs that Supabase will accept. Get the JWT secret from:
**Supabase Dashboard → Project Settings → API → JWT Settings → JWT Secret**

Add to `D:\Projects\vibe_remote(serverside)\.env`:

```
SUPABASE_JWT_SECRET=<paste-the-secret>
```

### 1d. Server — new endpoint `/mobile/realtime-token`

**File:** `D:\Projects\vibe_remote(serverside)\src\routes\mobile.js`

Install dependency in the server project:
```bash
npm install jsonwebtoken
```

Add this endpoint inside `mobile.js` (near the top, after the imports). Add this import at the top:

```js
import jwt from 'jsonwebtoken'
```

Then add the endpoint (just below the `/machine` endpoint):

```js
// POST /mobile/realtime-token — issue a short-lived Supabase JWT for Realtime auth
// The JWT puts the user_id into auth.uid() so existing RLS policies work.
router.post('/realtime-token', requireMachineAuth, (req, res) => {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    console.error('[realtime-token] SUPABASE_JWT_SECRET not set')
    return res.status(500).json({ error: 'Realtime token unavailable' })
  }

  const nowSec = Math.floor(Date.now() / 1000)
  const token = jwt.sign(
    {
      sub:  req.machine.user_id,
      role: 'authenticated',
      iat:  nowSec,
      exp:  nowSec + 60 * 60 * 12, // 12 hours
    },
    secret,
    { algorithm: 'HS256' }
  )

  res.json({ token, expiresAt: nowSec + 60 * 60 * 12 })
})
```

**Test it** with curl:
```bash
curl -X POST http://your-server/mobile/realtime-token -H "x-machine-api-key: <key>"
# → { "token": "eyJhbGc...", "expiresAt": 1234567890 }
```

### 1e. Mobile — add `supabaseUrl` to API config

The mobile already has `supabaseUrl` in `MachineCredentials` (in `src/api/server.ts`). Good — nothing to add. Phase 1f uses it directly.

### 1f. Mobile — create a Supabase Realtime client

**Create new file:** `D:\Projects\vibe_remote(reactNative)\AgentControl\src\api\realtime.ts`

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getCredentials } from './server'

// Singleton client — created on demand once we have a JWT
let client: SupabaseClient | null = null
let currentToken: string | null  = null

export async function getRealtimeClient(): Promise<SupabaseClient | null> {
  const creds = getCredentials()
  if (!creds) return null

  if (client && currentToken) return client

  // Fetch a JWT from our server
  const res = await fetch(`${creds.apiUrl}/mobile/realtime-token`, {
    method: 'POST',
    headers: { 'x-machine-api-key': creds.apiKey },
  })
  if (!res.ok) {
    console.warn('[realtime] token fetch failed', res.status)
    return null
  }
  const { token } = await res.json() as { token: string }

  // Supabase Realtime needs the anon key for connection setup,
  // then we set the JWT for auth. The anon key is public-safe.
  // We use an empty anon key here because we'll set Authorization explicitly via realtime.setAuth.
  // If your Supabase project rejects empty anon, set this to the actual anon key (safe to commit).
  client = createClient(creds.supabaseUrl, token, {
    auth:     { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  })

  client.realtime.setAuth(token)
  currentToken = token

  return client
}

export function clearRealtimeClient() {
  if (client) {
    try { client.realtime.disconnect() } catch {}
  }
  client = null
  currentToken = null
}
```

**Gotcha:** `@supabase/supabase-js` requires the second argument (the key) to be a string. The JWT works there for fully-authenticated clients. If Supabase rejects it, fall back to passing the anon key and only setting JWT via `client.realtime.setAuth(token)`. To support that, add `supabaseAnonKey` to the QR payload (`D:\Projects\vibe_remote(dekstop)\my-app` desktop side, the QR builder).

Check if `@supabase/supabase-js` is already installed in the mobile:

```bash
cd D:\Projects\vibe_remote(reactNative)\AgentControl
npm list @supabase/supabase-js
```

If not, install it: `npm install @supabase/supabase-js`

### 1g. Mobile — wire realtime into `useTerminalEvents`

**File:** `D:\Projects\vibe_remote(reactNative)\AgentControl\src\hooks\useTerminal.ts`

Replace the entire file with:

```ts
import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTerminalEvents } from '../api/server'
import { getRealtimeClient } from '../api/realtime'
import type { TerminalEvent } from '../types'

export function useTerminalEvents(sessionId?: string) {
  const qc = useQueryClient()
  const queryKey = ['terminal', sessionId ?? 'all']

  const query = useQuery<TerminalEvent[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetchTerminalEvents(sessionId, 60)
      return res.events
    },
    staleTime:       3_000,
    refetchInterval: 30_000, // safety net — Realtime is primary
  })

  useEffect(() => {
    if (!sessionId) return

    let unsub: (() => void) | null = null
    let cancelled = false

    ;(async () => {
      const client = await getRealtimeClient()
      if (!client || cancelled) return

      const channel = client
        .channel(`terminal:${sessionId}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'terminal_events',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const newRow = payload.new as TerminalEvent
            qc.setQueryData<TerminalEvent[]>(queryKey, (old = []) => {
              if (old.some(e => e.id === newRow.id)) return old
              return [...old, newRow].slice(-200) // cap memory
            })
          },
        )
        .subscribe()

      unsub = () => { try { channel.unsubscribe() } catch {} }
    })()

    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [sessionId, qc])

  return query
}
```

### 1h. Verify the flow

1. Open the mobile Terminal tab on a session.
2. On the desktop, run a Claude Code tool call (e.g., `Read package.json`).
3. The event should appear on mobile **within ~1 second** (Realtime), not the 5s of the old poll.
4. Pull-to-refresh still works (React Query refetch).
5. Background the app for 1 minute, come back — the 30s poll should have caught up.

**Phase 1 checklist:**
- [ ] `SUPABASE_JWT_SECRET` set in server `.env`
- [ ] `jsonwebtoken` installed in server
- [ ] `/mobile/realtime-token` endpoint added and tested with curl
- [ ] `realtime.ts` created in mobile
- [ ] `useTerminal.ts` rewritten with subscribe logic
- [ ] Live update verified end-to-end

---

## PHASE 2 — PTY capture for live narrative output

**Goal:** Capture Claude Code's full terminal output (including narrative between tool calls — "I'll now read the file...", "Cogitating...", etc.) and stream a filtered version to mobile as `terminal_output` events. Mobile renders them as italic gray lines between the structured event rows.

**Why this is the headline feature:** Currently there's a silent gap between tool calls on mobile. PTY capture closes that gap. This is the difference between "approval app" and "remote pair-programming session."

**Architecture overview:**

```
┌─────────────────────────────────────────────────────────┐
│  Electron desktop app                                   │
│                                                         │
│  ┌─────────────┐    ┌───────────────────┐               │
│  │ Dashboard   │ →  │ pty-host.js       │               │
│  │ (UI button) │    │ (node-pty wrapper)│               │
│  └─────────────┘    └─────────┬─────────┘               │
│                               │ spawns                  │
│                               ▼                         │
│                         ┌─────────────┐                 │
│                         │ claude code │                 │
│                         └─────┬───────┘                 │
│                               │ stdout                  │
│                               ▼                         │
│                       (PTY captures)                    │
│                               │                         │
│                               ▼                         │
│            ┌──────────────────────────────┐             │
│            │ output-filter.js              │            │
│            │  - strip ANSI                 │            │
│            │  - debounce 250ms             │            │
│            │  - skip lines < 3 chars       │            │
│            │  - dedupe spinner-only frames │            │
│            └──────────────┬───────────────┘             │
│                           │                             │
└───────────────────────────┼─────────────────────────────┘
                            │ POST /relay/terminal-event
                            ▼ event_type: 'output'
                    ┌──────────────────┐
                    │   Server         │
                    └──────┬───────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │   Mobile         │
                  │   (Phase 1       │
                  │    Realtime)     │
                  └──────────────────┘
```

### 2a. Install `node-pty` on the desktop

**Important Windows note:** `node-pty` requires native compilation. On Windows, install Visual Studio Build Tools first OR use prebuilt binaries.

```bash
cd D:\Projects\vibe_remote(dekstop)\my-app\relay-deamon1
npm install node-pty
```

If you get a compilation error, try:
```bash
npm install node-pty --build-from-source=false
```

Or use the prebuilt fork: `npm install @homebridge/node-pty-prebuilt-multiarch` (drop-in replacement, has Windows prebuilts).

Verify:
```bash
node -e "const pty = require('node-pty'); console.log(pty.spawn ? 'OK' : 'broken')"
```

### 2b. Create `pty-host.js`

**Create new file:** `D:\Projects\vibe_remote(dekstop)\my-app\relay-deamon1\src\pty-host.js`

This is a long-running process that manages **one** Claude Code PTY session and streams its output to the server.

```js
/**
 * pty-host.js — wraps a Claude Code instance in a PTY.
 *
 * Captures stdout, filters/samples, and posts to /relay/terminal-event.
 * Also exposes a writable channel for prompt injection (Phase 3).
 *
 * Usage:
 *   node pty-host.js --session-id <id> --cwd <path>
 *
 * Started/stopped by the Electron main process when the user clicks "Start session".
 */

import { spawn as ptySpawn } from 'node-pty'
import { randomUUID } from 'crypto'
import { postTerminalEvent, agentPing } from './supabase.js'
import { config } from './config.js'

// ── Args ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function arg(name) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : null
}

const sessionId = arg('session-id') || randomUUID()
const cwd       = arg('cwd')        || process.cwd()
const cmd       = process.platform === 'win32' ? 'claude.exe' : 'claude'

// ── Spawn Claude Code under a PTY ─────────────────────────────────────────────
const proc = ptySpawn(cmd, [], {
  name: 'xterm-256color',
  cols: 120,
  rows: 30,
  cwd,
  env: { ...process.env, CLAUDE_SESSION_ID: sessionId },
})

// Tell the server this session exists
agentPing(sessionId, cwd, null).catch(() => {})

// ── Output filtering ──────────────────────────────────────────────────────────
// Strip ANSI escape codes
const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]/g
// Lines that are pure cursor/spinner garbage — skip
const SKIP_RE = /^[\s⠁⠂⠄⡀⢀⠠⠐⠈\\\/\-\|·•⣾⣽⣻⢿⡿⣟⣯⣷]+$/

let buffer    = ''
let lastFlush = Date.now()
const FLUSH_INTERVAL_MS = 250  // debounce
const MIN_LINE_LEN      = 3

function flush() {
  if (!buffer) return
  const cleaned = buffer
    .replace(ANSI_RE, '')
    .split('\n')
    .map(l => l.trimEnd())
    .filter(l => l.length >= MIN_LINE_LEN && !SKIP_RE.test(l))
    .join('\n')
    .trim()

  buffer = ''
  lastFlush = Date.now()

  if (!cleaned) return

  // Cap each event to 2KB — anything longer is noise
  const summary = cleaned.slice(0, 2000)

  postTerminalEvent({
    session_id: sessionId,
    event_type: 'output',
    tool_name:  null,
    summary,
    detail:     null,
    status:     null,
  }).catch(() => {})
}

proc.onData((data) => {
  buffer += data
  if (Date.now() - lastFlush > FLUSH_INTERVAL_MS) flush()
})

setInterval(flush, FLUSH_INTERVAL_MS).unref()

// ── Prompt injection (Phase 3 reuses this) ────────────────────────────────────
// IPC: receive prompts to inject from a parent process via stdin
process.stdin.on('data', (chunk) => {
  try {
    const msg = JSON.parse(chunk.toString().trim())
    if (msg.type === 'prompt' && typeof msg.text === 'string') {
      proc.write(msg.text + '\r')
    }
    if (msg.type === 'resize' && msg.cols && msg.rows) {
      proc.resize(msg.cols, msg.rows)
    }
  } catch {}
})

// ── Mirror to local stdout so the Electron dashboard can show it ─────────────
proc.onData((data) => process.stdout.write(data))

proc.onExit(({ exitCode }) => {
  flush()
  postTerminalEvent({
    session_id: sessionId,
    event_type: 'stop',
    tool_name:  null,
    summary:    `Session exited (code ${exitCode})`,
    detail:     null,
    status:     exitCode === 0 ? 'success' : 'error',
  }).catch(() => process.exit(0))
  setTimeout(() => process.exit(0), 500)
})
```

### 2c. Server — handle the new `output` event type

The server's `/relay/terminal-event` endpoint already accepts any `event_type` value. **No server change needed** — `output` rows go straight into the same table.

(Optional: add a CHECK constraint in Supabase to validate event_type. Not required.)

### 2d. Mobile types — add the `output` variant

**File:** `D:\Projects\vibe_remote(reactNative)\AgentControl\src\types\index.ts`

Change `TerminalEvent.event_type`:

```ts
event_type: 'tool_start' | 'tool_end' | 'notification' | 'stop' | 'output'
```

### 2e. Mobile — render output rows

**File:** `D:\Projects\vibe_remote(reactNative)\AgentControl\src\screens\Terminal\TerminalScreen.tsx`

Add a new row component above `EventRow`:

```tsx
function OutputRow({ item }: { item: TerminalEvent }) {
  return (
    <View style={styles.outputRow}>
      <Text style={styles.outputText} selectable>
        {item.summary}
      </Text>
    </View>
  )
}
```

Update the dispatcher:

```tsx
function EventRow({ item }: { item: TerminalEvent }) {
  if (item.event_type === 'notification') return <NotificationRow item={item} />
  if (item.event_type === 'stop')         return <StopRow item={item} />
  if (item.event_type === 'output')       return <OutputRow item={item} />
  return <ToolRow item={item} />
}
```

Add styles at the bottom of the `StyleSheet.create({...})`:

```ts
outputRow: {
  paddingHorizontal: Spacing.px20,
  paddingVertical:   Spacing.px4,
  borderLeftWidth:   2,
  borderLeftColor:   Colors.borderHairline,
  marginLeft:        Spacing.px20,
},
outputText: {
  fontFamily: FontFamily.mono,
  fontSize:   FontSize.monoSmall,
  color:      Colors.textTertiary,
  lineHeight: 17,
},
```

### 2f. Electron UI — start/stop PTY sessions

**File:** `D:\Projects\vibe_remote(dekstop)\my-app\src\main.js`

Add IPC handlers near the existing `relay:setHookEnabled`:

```js
let ptyProcs = new Map() // sessionId → child process

ipcMain.handle('pty:start', (_, { sessionId, cwd }) => {
  if (ptyProcs.has(sessionId)) return { ok: true, alreadyRunning: true }

  const script = path.join(RELAY_ROOT, 'src', 'pty-host.js')
  const child = spawn('node', [script, '--session-id', sessionId, '--cwd', cwd || os.homedir()], {
    cwd:   RELAY_ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env:   { ...process.env },
  })

  ptyProcs.set(sessionId, child)

  child.on('exit', () => ptyProcs.delete(sessionId))
  child.stderr.on('data', d => console.error(`[pty:${sessionId}]`, d.toString()))

  return { ok: true, sessionId }
})

ipcMain.handle('pty:stop', (_, { sessionId }) => {
  const child = ptyProcs.get(sessionId)
  if (!child) return { ok: false, reason: 'not running' }
  child.kill()
  ptyProcs.delete(sessionId)
  return { ok: true }
})

ipcMain.handle('pty:sendPrompt', (_, { sessionId, text }) => {
  const child = ptyProcs.get(sessionId)
  if (!child) return { ok: false, reason: 'not running' }
  child.stdin.write(JSON.stringify({ type: 'prompt', text }) + '\n')
  return { ok: true }
})

ipcMain.handle('pty:list', () => Array.from(ptyProcs.keys()))
```

**File:** `D:\Projects\vibe_remote(dekstop)\my-app\src\preload.js`

Expose them to the renderer:

```js
pty: {
  start:       (args) => ipcRenderer.invoke('pty:start',       args),
  stop:        (args) => ipcRenderer.invoke('pty:stop',        args),
  sendPrompt:  (args) => ipcRenderer.invoke('pty:sendPrompt',  args),
  list:        ()     => ipcRenderer.invoke('pty:list'),
},
```

**File:** `D:\Projects\vibe_remote(dekstop)\my-app\src\components\Dashboard.jsx`

Add a "Start Claude Code session" button that calls `window.relay.pty.start({ sessionId: crypto.randomUUID(), cwd: '...' })`. The user enters a working directory; clicking start spawns Claude in a PTY.

(Specific UI design left for you to match the existing dashboard styling.)

### 2g. Optional — xterm.js viewer in Electron

Show what's happening in a panel in the Electron app using xterm.js:

```bash
npm install xterm xterm-addon-fit
```

Pipe `child.stdout` (from `pty:start`) into an xterm instance. Lets the user watch the same thing the mobile sees, but in the Electron app. Nice-to-have, not required.

### 2h. Filter tuning checklist

Once running, watch what comes through to mobile. You'll probably need to tweak `output-filter` rules:

- [ ] Are there long blank lines? Adjust `MIN_LINE_LEN`.
- [ ] Is the spinner ("Cogitating...") creating too many events? Add a regex to dedupe consecutive lines starting with a spinner word.
- [ ] Are tool output blocks duplicating what `PostToolUse` already sent? Add a `seen` set keyed on the first 50 chars.
- [ ] Is the rate too high? Increase `FLUSH_INTERVAL_MS` to 500ms.

**Phase 2 checklist:**
- [ ] `node-pty` installed and verified
- [ ] `pty-host.js` created
- [ ] Mobile types updated for `'output'` event
- [ ] `OutputRow` component added
- [ ] Electron IPC handlers added (`pty:start`, `pty:stop`, `pty:sendPrompt`)
- [ ] Preload bridge exposed
- [ ] Dashboard "Start session" button works
- [ ] Output appears on mobile within 1s of Claude printing
- [ ] Filter rules tuned to avoid spam

---

## PHASE 3 — Replace `WriteConsoleInput` with `pty.write`

**Goal:** Once Phase 2 is shipping, kill the fragile `WriteConsoleInput`/PowerShell prompt injection. Use the PTY directly.

**Why:** The current injection uses Windows `WriteConsoleInput` via a PowerShell script. It depends on the target terminal having focus, encoding being right, and timing. The PTY *is* the terminal — `pty.write(prompt + '\r')` is one line, always works, no race conditions.

### 3a. Find the current injection code

**File:** `D:\Projects\vibe_remote(dekstop)\my-app\relay-deamon1\scripts\heartbeat.js`

Look for the section that handles `/mobile/command/next` results and currently calls `tty-worker.cjs` or runs PowerShell `WriteConsoleInput`. (The exact lines depend on the current state of heartbeat.js — read it first.)

### 3b. Route prompts through the PTY when one exists

Replace the WriteConsoleInput call with:

```js
// Old approach (delete):
// await injectViaWriteConsoleInput(prompt, claudePid)

// New approach:
const { sessionId } = command
if (await ptyAlive(sessionId)) {
  // PTY-managed session — use IPC to the pty-host process
  await sendPromptToPty(sessionId, prompt)
} else {
  // Fallback for legacy sessions (user launched Claude themselves)
  await injectViaWriteConsoleInput(prompt, claudePid)
}
```

`ptyAlive(sessionId)` calls the Electron main process via... wait, heartbeat.js is a *child* of Electron, not the main process. Two options:

**Option A — Heartbeat queries the Electron app via HTTP**
Add a small HTTP server inside Electron main that exposes `GET /pty/alive?sessionId=...` and `POST /pty/prompt`. Heartbeat calls these locally.

**Option B — Move prompt delivery into pty-host.js**
Each `pty-host.js` polls `/mobile/command/next?sessionId=<own>` itself, claims commands scoped to its own session, calls `proc.write(prompt + '\r')`. Heartbeat no longer handles prompt delivery for PTY-managed sessions; it only handles non-PTY sessions and the existing heartbeat/fs duties.

**Go with Option B.** Cleaner separation, no new HTTP endpoint inside Electron.

### 3c. Add prompt polling to `pty-host.js`

Add to `pty-host.js` (Phase 2 file), at the bottom before the `proc.onExit`:

```js
// ── Poll for prompts addressed to this session ───────────────────────────────
async function pollPrompts() {
  try {
    const res = await fetch(
      `${config.apiUrl}/mobile/command/next?session_id=${encodeURIComponent(sessionId)}`,
      { headers: { 'x-machine-api-key': config.machineApiKey } }
    )
    if (!res.ok) return
    const data = await res.json()
    if (data?.prompt) {
      proc.write(data.prompt + '\r')
    }
  } catch {}
}

setInterval(pollPrompts, 5000).unref()
```

**Important:** This requires the server's `/mobile/command/next` to support filtering by `session_id` in the query string. Check `D:\Projects\vibe_remote(serverside)\src\routes\mobile.js` — the current endpoint already filters by command's `session_id`, but it doesn't take a query param. Add support:

```js
// In /mobile/command/next, change the query line:
const targetSessionId = req.query.session_id
let q = db.from('mobile_commands').select('*')
  .eq('machine_id', req.machine.id)
  .eq('status', 'pending')

if (targetSessionId) q = q.eq('session_id', targetSessionId)

// ...rest stays the same, but the idle-gating logic can be simpler for PTY sessions
// because the PTY *is* the live terminal — no need to wait 30s; we know it's idle
// if no tool_start arrived recently. Optional optimization.
```

### 3d. Disable heartbeat injection for PTY-managed sessions

In heartbeat.js, when polling `/mobile/command/next`, filter out sessions that are PTY-managed. Simplest approach: add a `pty_managed` column on `agents` table (boolean, default false). `pty-host.js` sets it to true on startup. Heartbeat queries `agents` and skips those rows.

```sql
alter table agents add column pty_managed boolean not null default false;
```

In `pty-host.js`, on startup:
```js
// Mark this agent as PTY-managed so heartbeat doesn't compete for prompts
await fetch(`${config.apiUrl}/relay/agent-update`, {
  method:  'POST',
  headers: {
    'Content-Type':      'application/json',
    'x-machine-api-key': config.machineApiKey,
  },
  body: JSON.stringify({ sessionId, pty_managed: true }),
}).catch(() => {})
```

Add `/relay/agent-update` to the server (`D:\Projects\vibe_remote(serverside)\src\routes\relay.js`):

```js
router.post('/agent-update', requireMachineAuth, async (req, res) => {
  const { sessionId, pty_managed } = req.body
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  const { error } = await db.from('agents').update({ pty_managed })
    .eq('session_id', sessionId)
    .eq('machine_id', req.machine.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})
```

### 3e. Remove `WriteConsoleInput` once PTY is stable

After Phase 2 + 3 have been in production for a week with no issues:
- Delete `tty-worker.cjs`
- Delete the WriteConsoleInput / PowerShell injection code from heartbeat.js
- Keep heartbeat.js only for: machine heartbeat ping + fs_requests serving

**Phase 3 checklist:**
- [ ] `agents.pty_managed` column added in Supabase
- [ ] `/relay/agent-update` endpoint added
- [ ] `pty-host.js` marks itself as PTY-managed on startup
- [ ] `pty-host.js` polls for and writes prompts via `proc.write`
- [ ] Heartbeat skips PTY-managed agents
- [ ] Prompts delivered via PTY-managed session work end-to-end
- [ ] (Later) WriteConsoleInput code removed

---

## Implementation order — what to do first

1. **Phase 1 (Realtime)** — biggest UX/effort ratio. Ship this first; it makes the existing app feel modern.
2. **Phase 2a–2e** — get PTY output flowing to mobile. Ship even before the dashboard UI is polished; you can spawn pty-host.js from a script for testing.
3. **Phase 2f–2g** — Electron dashboard integration. Polish.
4. **Phase 3** — PTY injection and removal of WriteConsoleInput. Only after Phase 2 is rock-solid.

## Things to test as you go

- Multiple sessions running simultaneously
- App backgrounded for 5+ minutes — does Realtime reconnect cleanly?
- PTY process crash — does the agent row stay `is_online=false` so mobile knows?
- Prompt injection race: send 3 prompts quickly — does the PTY queue them correctly?
- Bash command with very long output (e.g., `cat package-lock.json`) — does the filter dedupe / cap correctly without dropping important content?

## Gotchas — read before starting each phase

**Phase 1:**
- The Supabase JWT secret is **different** from the anon key and the service role key. Get it from the JWT settings panel.
- If `client.realtime.setAuth(token)` errors, fall back to passing the anon key + setting JWT separately. Add `supabaseAnonKey` to the QR payload to support this.
- Don't forget to `unsubscribe()` on screen unmount or you'll leak channels.

**Phase 2:**
- `node-pty` Windows install is the most likely failure point. Have the prebuilt fork ready as Plan B.
- The PTY output filter is the hard part. Start permissive (let everything through), then tighten based on what you actually see on mobile.
- 2KB per event × 5 events/sec = 10KB/s sustained, ~36MB/hour. Watch Supabase storage if you have heavy users; consider a retention policy:
  ```sql
  delete from terminal_events where created_at < now() - interval '7 days';
  ```

**Phase 3:**
- Don't delete the WriteConsoleInput path until PTY mode has been stable for at least a week.
- The CLI fallback (`! node relay.cjs 1`) for approvals doesn't depend on prompt injection — it's the other direction. It keeps working unchanged.

---

## TL;DR for whoever is implementing

- Phase 1 = polling → push. ~1 day. Ship first.
- Phase 2 = the actual "live narrative" feature. ~1 week. Ship second.
- Phase 3 = bonus side effect of Phase 2. ~1 day. Ship when Phase 2 is stable.

Together, this turns the Terminal tab from "log of what happened" into "I'm watching Claude work."
