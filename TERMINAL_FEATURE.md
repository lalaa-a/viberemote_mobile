# Terminal Tab — Live Claude Activity Feed

Replaces the History tab (which is now redundant — the Requests tab shows both pending and history). The Terminal tab gives the user a real-time view of what Claude Code is doing: thinking indicators, tool executions as they happen, progress messages, and completion summaries.

---

## What the user sees

```
┌──────────────────────────────────┐
│ Vibe Remote                      │
│ Terminal            [session ▼]  │
├──────────────────────────────────┤
│  ● my-macbook  •  active         │
│    ~/projects/vibe-remote        │
├──────────────────────────────────┤
│ 🔵  Cogitating...           ···  │  ← cycles through spinner words
│                                  │
│ ✅  Read  src/server.ts          │
│     46 lines · 0.2s ago          │
│                                  │
│ ✅  Bash  npm run build          │
│     exit 0 · "Build succeeded"   │
│     1.4s · 2m ago                │
│                                  │
│ 💬  Checking for TypeScript      │
│     errors before committing...  │
│     3m ago                       │
│                                  │
│ ✅  Edit  src/index.ts           │
│     +3 −1 · 3m ago               │
│                                  │
│ 🏁  Task finished                │
│     "Updated the auth middleware" │
│     5m ago                       │
└──────────────────────────────────┘
```

**Event types shown:**
| Icon | Type | When |
|------|------|------|
| 🔵 ··· | thinking | Session active, no tool pending |
| 🔵 ⏳ | waiting approval | `pending_count > 0` |
| ✅ | tool success | PostToolUse, exit 0 / no error |
| ❌ | tool error | PostToolUse, exit ≠ 0 or error field set |
| 💬 | notification | Claude's progress messages |
| 🏁 | stop | Session ends / Claude reports done |

---

## How to get the data — full pipeline

Claude Code fires hooks for every lifecycle event. We currently use only `PreToolUse`. We need three more:

```
PreToolUse    → already used (approval gate)
PostToolUse   → NEW: fires after each tool completes
Notification  → NEW: fires with Claude's progress messages
Stop          → NEW: fires when Claude finishes
```

---

## Step 1 — Database (Supabase)

Add one new table:

```sql
create table terminal_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  text        not null,
  machine_id  uuid        not null references machines(id) on delete cascade,
  user_id     uuid        not null,
  event_type  text        not null,
  -- event_type: 'tool_start' | 'tool_end' | 'notification' | 'stop'
  tool_name   text,           -- Bash, Write, Edit, MultiEdit, Read (null for notification/stop)
  summary     text,           -- human-readable one-liner
  detail      text,           -- first 500 chars of output or message body
  status      text,           -- 'success' | 'error' | null
  duration_ms integer,        -- tool_end only
  created_at  timestamptz     not null default now()
);

-- Index for fast per-session queries
create index terminal_events_session_idx on terminal_events (session_id, created_at desc);
create index terminal_events_user_idx    on terminal_events (user_id, created_at desc);

-- RLS: users see only their own events
alter table terminal_events enable row level security;
create policy "user reads own events"
  on terminal_events for select
  using (auth.uid() = user_id);
```

No foreign key to `pending_requests` — these are independent events.

---

## Step 2 — Desktop (relay-deamon1)

### 2a. New Claude Code hook scripts

Claude Code settings (`~/.claude/settings.json` or project `.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse":  [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node /path/to/relay-deamon1/hook.js" }] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node /path/to/relay-deamon1/postHook.js" }] }],
    "Notification":[{ "hooks": [{ "type": "command", "command": "node /path/to/relay-deamon1/notifyHook.js" }] }],
    "Stop":        [{ "hooks": [{ "type": "command", "command": "node /path/to/relay-deamon1/stopHook.js" }] }]
  }
}
```

### 2b. `postHook.js` — PostToolUse handler

```js
// relay-deamon1/postHook.js
import { readFileSync } from 'fs'
import { config } from './src/config.js'
import { post } from './src/supabase.js'   // reuse existing helper

const event = JSON.parse(readFileSync('/dev/stdin', 'utf8'))
// Shape: { session_id, tool_name, tool_input, tool_response }
// tool_response: { output?, error?, exit_code? } for Bash
//               { success: bool }               for file tools

const { session_id, tool_name, tool_input, tool_response } = event

const isError = tool_response?.exit_code > 0 || !!tool_response?.error

// Build a short summary for display
let summary = ''
let detail  = ''

if (tool_name === 'Bash') {
  const cmd = (tool_input?.command || '').slice(0, 80)
  summary = `Bash: ${cmd}`
  const out = tool_response?.output || tool_response?.error || ''
  detail = out.slice(0, 500)
} else if (tool_name === 'Read') {
  summary = `Read ${tool_input?.file_path || ''}`
} else if (tool_name === 'Write') {
  summary = `Write ${tool_input?.file_path || ''}`
} else if (tool_name === 'Edit') {
  summary = `Edit ${tool_input?.file_path || ''}`
} else if (tool_name === 'MultiEdit') {
  const count = (tool_input?.edits || []).length
  summary = `MultiEdit ${count} file${count !== 1 ? 's' : ''}`
}

await post('/relay/terminal-event', {
  session_id,
  event_type: 'tool_end',
  tool_name,
  summary,
  detail,
  status: isError ? 'error' : 'success',
})

process.exit(0)   // PostToolUse must exit 0 — never block
```

### 2c. `notifyHook.js` — Notification handler

```js
// relay-deamon1/notifyHook.js
import { readFileSync } from 'fs'
import { config } from './src/config.js'
import { post } from './src/supabase.js'

const event = JSON.parse(readFileSync('/dev/stdin', 'utf8'))
// Shape: { session_id, message }

await post('/relay/terminal-event', {
  session_id: event.session_id,
  event_type: 'notification',
  tool_name:  null,
  summary:    (event.message || '').slice(0, 200),
  detail:     null,
  status:     null,
})

process.exit(0)
```

### 2d. `stopHook.js` — Stop handler

```js
// relay-deamon1/stopHook.js
import { readFileSync } from 'fs'
import { config } from './src/config.js'
import { post } from './src/supabase.js'

const event = JSON.parse(readFileSync('/dev/stdin', 'utf8'))
// Shape: { session_id, stop_reason?, result? }

const summary = event.result
  ? (event.result.slice(0, 200))
  : 'Task finished'

await post('/relay/terminal-event', {
  session_id: event.session_id,
  event_type: 'stop',
  tool_name:  null,
  summary,
  detail:     null,
  status:     'success',
})

process.exit(0)
```

### 2e. Also emit `tool_start` from PreToolUse (optional but useful)

In the existing `hook.js`, right after `uploadRequest()` succeeds (fire-and-forget, don't await the decision):

```js
// Inside hook.js, after building parsed event — fire and forget
post('/relay/terminal-event', {
  session_id,
  event_type: 'tool_start',
  tool_name,
  summary: parsed.summary,
  status: null,
}).catch(() => {})
```

This lets the mobile show "Bash: npm test (pending approval)" before the user even decides.

---

## Step 3 — Server (serverside)

### 3a. New relay endpoint `/relay/terminal-event`

Add to `src/routes/relay.js`:

```js
router.post('/terminal-event', requireMachineAuth, async (req, res) => {
  const { machine, user_id } = req.auth   // populated by requireMachineAuth

  const {
    session_id, event_type, tool_name,
    summary, detail, status,
  } = req.body

  if (!session_id || !event_type) return res.status(400).json({ error: 'missing fields' })

  const { error } = await supabase
    .from('terminal_events')
    .insert({
      session_id,
      machine_id: machine.id,
      user_id,
      event_type,
      tool_name:  tool_name ?? null,
      summary:    summary ?? null,
      detail:     detail  ?? null,
      status:     status  ?? null,
    })

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
})
```

### 3b. New mobile endpoint `/mobile/terminal`

Add to `src/routes/mobile.js`:

```js
// GET /mobile/terminal?session_id=xxx&limit=40
router.get('/terminal', requireMachineAuth, async (req, res) => {
  const { user_id } = req.auth
  const { session_id, limit = 40 } = req.query

  let query = supabase
    .from('terminal_events')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(Number(limit))

  if (session_id) query = query.eq('session_id', session_id)

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })
  res.json({ events: (data || []).reverse() })   // oldest-first for display
})
```

---

## Step 4 — Mobile app

### 4a. Remove History tab

In `src/navigation/RootNavigator.tsx`:
- Remove `HistoryTab` from `Tab.Navigator`
- Remove `HistoryScreen` import
- Add `TerminalTab` with `TerminalScreen`

### 4b. New hook `src/hooks/useTerminal.ts`

```ts
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/server'

export function useTerminalEvents(sessionId?: string) {
  return useQuery({
    queryKey: ['terminal', sessionId],
    queryFn: () => api.get('/mobile/terminal', { params: { session_id: sessionId, limit: 60 } })
                      .then(r => r.data.events as TerminalEvent[]),
    refetchInterval: 5000,   // poll every 5s
    staleTime: 3000,
  })
}
```

Add `TerminalEvent` to `src/types/index.ts`:

```ts
export interface TerminalEvent {
  id:         string
  session_id: string
  machine_id: string
  event_type: 'tool_start' | 'tool_end' | 'notification' | 'stop'
  tool_name:  string | null
  summary:    string | null
  detail:     string | null
  status:     'success' | 'error' | null
  created_at: string
}
```

### 4c. "Thinking" indicator

No hook fires when Claude is thinking between tool calls. Derive it from the `agents` table:

- Fetch the current session from `useSession(sessionId)` (already exists)
- If `session.status === 'active'` AND last terminal event was a `tool_end` or `stop` → show thinking dot
- If `session.pending_count > 0` → show "Waiting for approval" instead
- The `last_activity_at` on the agent updates every tool call, so a fresh timestamp + no new events = thinking

In code (inside TerminalScreen):

```ts
const isThinking = useMemo(() => {
  if (!session) return false
  if (session.pending_count > 0) return false         // waiting, not thinking
  const secsSinceLast = (Date.now() - new Date(session.last_activity_at).getTime()) / 1000
  return secsSinceLast < 30 && session.status === 'active'
}, [session, events])
```

### 4d. `src/screens/Terminal/TerminalScreen.tsx` — UI structure

```
TerminalScreen
├── Header: "Vibe Remote" / "Terminal" + session picker dropdown
├── SessionBanner: machine label, cwd, status dot
├── FlatList of TerminalEvent rows (inverted=false, newest at bottom)
│   ├── ThinkingRow (animated pulsing dot) — shown when isThinking
│   ├── ToolRow (tool_start / tool_end)
│   │   ├── Icon (tool type color dot)
│   │   ├── Tool name + summary
│   │   ├── Status badge (success/error/pending)
│   │   └── Timestamp
│   ├── NotificationRow (notification)
│   │   ├── 💬 icon
│   │   └── Message text + timestamp
│   └── StopRow (stop)
│       ├── 🏁 icon
│       ├── Summary text
│       └── Timestamp
└── (no input — user sends prompts from Sessions tab)
```

**Animated thinking dot:**

```tsx
function ThinkingDot() {
  const opacity = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    ).start()
  }, [])
  return (
    <View style={styles.thinkingRow}>
      <Animated.View style={[styles.thinkingDot, { opacity }]} />
      <Animated.View style={[styles.thinkingDot, { opacity, marginLeft: 4 }]} />
      <Animated.View style={[styles.thinkingDot, { opacity, marginLeft: 4 }]} />
      <Text style={styles.thinkingText}>Claude is thinking</Text>
    </View>
  )
}
```

**The exact spinner words from Claude Code's binary** (extracted from `strings claude.exe`):

```ts
// src/screens/Terminal/spinnerWords.ts
export const SPINNER_WORDS = [
  'Brewing',
  'Canoodling',
  'Cogitating',
  'Cooking',
  'Discombobulating',
  'Noodling',
  'Pondering',
  'Ruminating',
]
```

These are the identical words Claude Code cycles through on the desktop. Showing the same words on mobile makes it feel like a true mirror of the desktop session.

**Cycling logic** — pick a new word every ~2s, change on each thinking session start:

```tsx
function ThinkingRow({ isPendingApproval }: { isPendingApproval: boolean }) {
  const [wordIdx, setWordIdx] = useState(() => Math.floor(Math.random() * SPINNER_WORDS.length))
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1,   duration: 500, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 500, useNativeDriver: true }),
      ])
    )
    pulse.start()

    // Cycle through words every 2s
    const interval = setInterval(() => {
      setWordIdx(i => (i + 1) % SPINNER_WORDS.length)
    }, 2000)

    return () => { pulse.stop(); clearInterval(interval) }
  }, [])

  const label = isPendingApproval
    ? 'Waiting for approval'
    : SPINNER_WORDS[wordIdx] + '...'

  return (
    <View style={styles.thinkingRow}>
      <Animated.View style={[styles.thinkingDot, { opacity }]} />
      <Text style={styles.thinkingText}>{label}</Text>
    </View>
  )
}
```

The word cycles silently in the background — no fade-in/out on the text itself, just the dot pulses. Keeps it subtle.

**Tool row with color per tool:**

```tsx
// Reuse Colors.tool palette that already exists
const TOOL_ICONS = {
  Bash:      'terminal-outline',
  Write:     'document-outline',
  Edit:      'create-outline',
  MultiEdit: 'documents-outline',
  Read:      'eye-outline',
}
```

---

## Step 5 — Navigation wiring

In `RootNavigator.tsx`:

```tsx
// Remove:
<Tab.Screen name="HistoryTab"   component={HistoryScreen}   ... />

// Add:
<Tab.Screen
  name="TerminalTab"
  component={TerminalScreen}
  options={{
    tabBarLabel: 'Terminal',
    tabBarIcon: ({ color, size }) => (
      <Ionicons name="terminal-outline" color={color} size={size} />
    ),
  }}
/>
```

Tab order: Requests | Sessions | Terminal | Machines

---

## Implementation order

1. **Supabase** — create `terminal_events` table + RLS policy
2. **Server** — add `/relay/terminal-event` + `/mobile/terminal` endpoints
3. **Desktop** — add `postHook.js`, `notifyHook.js`, `stopHook.js`; update Claude Code settings
4. **Desktop** — optionally add `tool_start` fire-and-forget in `hook.js`
5. **Mobile types** — add `TerminalEvent` to `types/index.ts`
6. **Mobile hook** — `src/hooks/useTerminal.ts`
7. **Mobile screen** — `src/screens/Terminal/TerminalScreen.tsx`
8. **Mobile nav** — swap History tab for Terminal tab in `RootNavigator.tsx`

---

## What data each hook receives (Claude Code hook stdin shapes)

```jsonc
// PreToolUse (existing)
{ "session_id": "abc", "tool_name": "Bash", "tool_input": { "command": "npm test" } }

// PostToolUse
{
  "session_id": "abc",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" },
  "tool_response": {
    "output": "All tests passed\n",
    "error": "",
    "exit_code": 0
  }
}
// For file tools (Write/Edit/Read), tool_response is just:
// { "success": true } or { "error": "..." }

// Notification
{ "session_id": "abc", "message": "Searching for files matching *.ts..." }

// Stop
{ "session_id": "abc", "stop_reason": "end_turn", "result": "I've updated the auth middleware." }
```

---

## Limitations & trade-offs

| Decision | Reason |
|----------|--------|
| Poll 5s (not WebSocket) | Consistent with rest of app; Supabase Realtime would add complexity |
| No stdout stream | Too noisy; structured hook events give cleaner data |
| `detail` capped at 500 chars | Bash output can be huge; enough for context without overloading |
| Thinking derived from `last_activity_at` | Claude Code has no explicit "thinking" hook; 30s window is a safe proxy |
| `tool_start` is optional | PostToolUse gives richer data; start event only useful for long-running Bash commands |
| Events are append-only | No need to update; simplifies RLS and polling |
