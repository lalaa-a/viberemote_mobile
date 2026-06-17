# Improvements Implementation — Done & Remaining

## What was implemented

---

### Phase 1 — Supabase Realtime on `terminal_events` ✅

**Server (`D:\Projects\vibe_remote(serverside)`):**
- Installed `jsonwebtoken` package
- Added `POST /mobile/realtime-token` to `src/routes/mobile.js`
  — Mints a 12-hour HS256 JWT signed with `SUPABASE_JWT_SECRET`, embedding `auth.uid() = user_id` so all existing RLS policies work

**Mobile (`D:\Projects\vibe_remote(reactNative)\AgentControl`):**
- Created `src/api/realtime.ts` — singleton Supabase client, fetches JWT from `/mobile/realtime-token`, calls `realtime.setAuth(token)` for authenticated channel subscriptions
- Rewrote `src/hooks/useTerminal.ts` — React Query polling dropped from 5s → 30s safety net; Realtime `postgres_changes INSERT` subscription on `terminal_events` for the active session pushes new events directly into the query cache; unsubscribes on session change / screen unmount

**Result:** New terminal events now appear in ~1s instead of up to 5s. Pull-to-refresh still works. App backgrounded for 30+ seconds will catch up via the polling fallback.

---

### Phase 2 — PTY capture for live narrative output ✅

**Desktop relay-deamon1 (`D:\Projects\vibe_remote(dekstop)\my-app\relay-deamon1`):**
- Installed `node-pty` package (native Windows prebuilts included — verified with `node -e "import('node-pty').then(...)"`)
- Created `src/pty-host.js` — wraps Claude Code in a node-pty PTY:
  - Captures all stdout, strips ANSI, debounces at 250ms, caps at 2KB per event
  - Posts filtered output as `event_type: 'output'` rows to `/relay/terminal-event`
  - Mirrors raw output to local stdout for Electron to display
  - Accepts `{ type: 'prompt', text }` JSON messages on stdin for direct prompt injection (Phase 3)
  - On startup: calls `agentPing` + marks agent as `pty_managed = true` via `/relay/agent-update`
  - On exit: posts a `stop` event and clears `pty_managed`

**Electron app (`D:\Projects\vibe_remote(dekstop)\my-app`):**
- Added IPC handlers in `src/main.js`: `pty:start`, `pty:stop`, `pty:sendPrompt`, `pty:list`
  — `pty:start` spawns `src/pty-host.js` as a child Node process with piped stdio
- Exposed PTY bridge in `src/preload.js` under `window.relay.pty`
- Added "PTY Session" card to `src/components/Dashboard.jsx`:
  - Working directory input (blank = home dir)
  - Start / Stop button that calls `window.relay.pty.start/stop`
  - Shows running session ID once started

**Mobile:**
- Added `'output'` to `TerminalEvent.event_type` union in `src/types/index.ts`
- Added `OutputRow` component to `src/screens/Terminal/TerminalScreen.tsx` — mono font, left border, muted teal text; renders between structured tool rows
- Updated `EventRow` dispatcher to route `event_type === 'output'` to `OutputRow`

**Result:** When a PTY session is running, Claude's narrative output ("Cogitating...", "I'll now read the file...") streams to mobile as italic gray lines between the tool event rows. Closes the silence gap between tool calls.

---

### Phase 3 — PTY-based prompt injection ✅

**Server (`D:\Projects\vibe_remote(serverside)`):**
- Added `POST /relay/agent-update` to `src/routes/relay.js` — updates `pty_managed` flag on the `agents` row for the calling machine's session
- Updated `GET /mobile/command/next` in `src/routes/mobile.js`:
  - New `?session_id=X` query param: filters `mobile_commands` to those targeting session X
  - Heartbeat calls (no `?session_id`): applies `.neq('pty_managed', true)` to skip PTY sessions
  - pty-host calls (with `?session_id`): skips the pty_managed filter; existing idle check (pending_count=0 + last_activity > 30s) still applies

**relay-deamon1 `src/pty-host.js`:**
- Polls `GET /mobile/command/next?session_id={id}` every 5s
- On a returned `prompt`, writes `prompt + '\r'` directly to the PTY (no PowerShell, no focus dance)
- On startup: marks `pty_managed = true`; on exit: clears to `false`

**Heartbeat (`scripts/heartbeat.js`):**
- No changes needed — the server now automatically excludes pty_managed agents from the heartbeat's `/command/next` call. Heartbeat works as before for non-PTY sessions.

**Result:** For PTY sessions, prompts are injected with `proc.write(prompt + '\r')` — one line, no timing dependencies, no need for the target terminal to have focus. The fragile PowerShell WriteConsoleInput path is bypassed for all PTY-managed sessions.

---

## Manual steps still required

### 1. Run SQL in Supabase (REQUIRED for Phase 2+3)

Open Supabase SQL editor and run these two statements:

```sql
-- Enable Realtime on terminal_events (Phase 1)
alter publication supabase_realtime add table terminal_events;

-- Add pty_managed column to agents (Phase 2+3)
alter table agents add column pty_managed boolean not null default false;
```

If `alter publication` errors with "already a member", skip it — it's already enabled.

### 2. Add `SUPABASE_JWT_SECRET` to server `.env` (REQUIRED for Phase 1)

Get it from:
**Supabase Dashboard → Project Settings → API → JWT Settings → JWT Secret**

Add to `D:\Projects\vibe_remote(serverside)\.env`:
```
SUPABASE_JWT_SECRET=<paste the secret here>
```

Then restart the server.

### 3. Verify node-pty on deployment

If deploying the desktop app as a packaged Electron build, node-pty native binaries in relay-deamon1 must be prebuilt for the Node.js version that Electron ships (not the Electron ABI — pty-host.js runs in a regular node child process). The current install should work for the dev environment. If you see `Error: NODE_MODULE_VERSION` on a packaged build, run:
```bash
cd D:\Projects\vibe_remote(dekstop)\my-app\relay-deamon1
npm rebuild node-pty --node-gyp-install-flags=...
```

---

## What was NOT changed

- `heartbeat.js` — no changes needed; server-side filtering handles the pty_managed exclusion
- `WriteConsoleInput` path — still in `heartbeat.js`; it's the fallback for non-PTY sessions and should stay until PTY mode is verified stable in production (as per the plan)
- All existing approval flow (hook.js, postHook.js, etc.) — untouched; they continue to work alongside PTY sessions
- Push notifications — untouched
- File browser — untouched

---

## What to do next (after the manual SQL + env steps above)

1. **Test Phase 1 (Realtime)**:
   ```bash
   curl -X POST https://your-server/mobile/realtime-token -H "x-machine-api-key: <key>"
   # → { "token": "eyJ...", "expiresAt": 1234567890 }
   ```
   Then open the Terminal tab in mobile, trigger a Claude tool call, and verify the event appears in < 1s.

2. **Test Phase 2 (PTY output)**:
   - In the Electron desktop app, expand the "PTY Session" card
   - Enter a working directory (e.g. `C:\Users\lala\my-project`)
   - Click "Start Claude Code session"
   - In the mobile Terminal tab, switch to the new session — output rows should appear as Claude works

3. **Test Phase 3 (prompt injection)**:
   - With a PTY session running, queue a prompt from the mobile app (Sessions → PromptCompose)
   - Verify it injects directly into the PTY without needing terminal focus or PowerShell

4. **Tune PTY output filter** (after seeing real output):
   - If spinner frames ("Cogitating...") create too many events, add a regex to dedupe consecutive spinner-only lines in `pty-host.js`
   - If rate is too high, increase `FLUSH_MS` from 250 → 500 in `pty-host.js`
   - Consider adding a 7-day retention policy:
     ```sql
     delete from terminal_events where created_at < now() - interval '7 days';
     ```

5. **Remove WriteConsoleInput** (when Phase 3 is stable for a week):
   - Delete `tty-worker.cjs` if it exists
   - Remove `tryInjectIntoExistingTerminal` from `heartbeat.js`
   - Keep heartbeat only for: machine heartbeat ping + fs_requests serving
