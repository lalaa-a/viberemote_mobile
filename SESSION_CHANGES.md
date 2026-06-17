# Session Changes — Vibe Remote Improvements

## Overview

Three improvements implemented across all three codebases (mobile, desktop, server):
1. **Supabase Realtime** — terminal events push to mobile in ~1s instead of 5s polling
2. **PTY capture** — live Claude Code terminal output streams to mobile Terminal tab
3. **PTY prompt injection** — replaces fragile WriteConsoleInput for PTY-managed sessions
4. **Auto-session detection** — toggle enables PTY sessions automatically from detected cwds, resuming existing Claude conversations

---

## Manual steps required (Supabase SQL editor)

Run these once before using the new features:

```sql
-- Enable Realtime push on terminal_events (Phase 1)
alter publication supabase_realtime add table terminal_events;

-- Add pty_managed column for Phase 2/3
alter table agents add column pty_managed boolean not null default false;
```

---

## Server — `D:\Projects\vibe_remote(serverside)`

### `package.json`
- Added `jsonwebtoken` dependency

### `src/routes/mobile.js`
- Added import: `import jwt from 'jsonwebtoken'` and `authClient` from supabase
- **Added** `POST /mobile/realtime-token` — issues a Supabase-compatible JWT for Realtime auth on the mobile client. Two methods tried in order:
  - Method 1: Signs with `SUPABASE_JWT_SECRET` from `.env` if available (~0ms)
  - Method 2: Uses `admin.generateLink` + `authClient.auth.verifyOtp` — no secret needed, ~300ms, runs automatically when secret is not set
- **Updated** `GET /mobile/command/next`:
  - Added `?session_id=X` query param — pty-host.js passes this to fetch only its own session's commands
  - Heartbeat calls (no query param): filters out `pty_managed = true` agents so they don't get double-delivered
  - pty-host calls (with `?session_id`): skips the pty_managed filter since pty-host handles its own delivery

### `src/routes/relay.js`
- **Added** `GET /relay/sessions` — returns active sessions for the calling machine (session_id, cwd, pending_count, pty_managed). Used by the desktop Dashboard to auto-detect running Claude Code sessions.
- **Added** `POST /relay/agent-update` — sets `pty_managed` flag on an agent row. Called by pty-host.js on startup (true) and exit (false).

---

## Desktop — `D:\Projects\vibe_remote(dekstop)\my-app`

### `relay-deamon1/package.json`
- Added `node-pty` dependency (verified working on Windows)

### `relay-deamon1/src/pty-host.js` ← NEW FILE
Wraps Claude Code in a node-pty PTY. Features:
- Accepts `--session-id`, `--cwd`, `--resume` args
- Spawns `claude` (or `claude.exe`) with `--resume <id>` when resuming an existing session
- Captures all stdout, strips ANSI codes, debounces 250ms, caps at 2KB/event, posts as `event_type: 'output'` to `/relay/terminal-event`
- Mirrors raw output to local stdout for Electron to display
- On startup: calls `agentPing` + marks agent as `pty_managed = true` via `/relay/agent-update`
- On exit: posts a `stop` event, clears `pty_managed = false`
- Polls `GET /mobile/command/next?session_id=X` every 5s, injects received prompts via `proc.write(prompt + '\r')` — replaces WriteConsoleInput for PTY sessions
- Accepts `{ type: 'prompt', text }` JSON on stdin for direct injection from Electron

### `src/main.js`
- **Added** `relay:getSessions` IPC handler — fetches `/relay/sessions` from the server using the machine's stored API key. Returns active sessions for this machine.
- **Added** PTY IPC handlers:
  - `pty:start({ sessionId, cwd, resume })` — spawns `pty-host.js` as a child Node process with piped stdio. Passes `--resume` arg when provided.
  - `pty:stop({ sessionId })` — kills the child process
  - `pty:sendPrompt({ sessionId, text })` — writes JSON to pty-host stdin for direct prompt injection
  - `pty:list()` — returns array of running session IDs

### `src/preload.js`
- Exposed `window.relay.getSessions()` → `relay:getSessions`
- Exposed `window.relay.pty.{ start, stop, sendPrompt, list }` bridge

### `src/components/Dashboard.jsx`
- **Added** state: `ptyProcs` (map of running sessionId → cwd), `detectedSessions`, `ptyLoading`
- **Added** `loadDetectedSessions()` — calls `window.relay.getSessions()`, populates `detectedSessions`
- **Updated** `toggleHook()` — when enabling, calls `loadDetectedSessions()` automatically
- **Updated** `initMachine()` — if hook is already enabled on load, calls `loadDetectedSessions()`
- **Added** `startPty(cwd, resumeSessionId?)` — starts a PTY session. If `resumeSessionId` provided, uses it as the session_id (so mobile Terminal tab shows existing session) and passes `--resume` to Claude.
- **Added** `startAllDetected()` — starts PTY for every detected session not already running, each with `--resume` for their existing session_id
- **Replaced** PTY card with multi-session "PTY Sessions" card:
  - Shows detected sessions with cwd, status dot (running/stopped), Start/Stop per row
  - "Start all" button for one-click enabling all detected sessions
  - Manual new session input + `+` button at the bottom
  - "Refresh detected sessions" link

---

## Mobile — `D:\Projects\vibe_remote(reactNative)\AgentControl`

### `src/types/index.ts`
- Added `'output'` to `TerminalEvent.event_type` union (for PTY capture events)

### `src/api/realtime.ts` ← NEW FILE
Singleton Supabase Realtime client:
- Fetches a JWT from `POST /mobile/realtime-token` using the stored machine API key
- Creates a `@supabase/supabase-js` client with that JWT and calls `realtime.setAuth(token)`
- `clearRealtimeClient()` exported for logout/re-auth flows

### `src/hooks/useTerminal.ts`
- **Rewritten** — React Query polling dropped from 5s → 30s (safety net only)
- Adds a Supabase Realtime `postgres_changes` subscription on `terminal_events` for the active session
- New events pushed directly into the React Query cache (appear in ~1s)
- Unsubscribes cleanly on session change or unmount

### `src/screens/Terminal/TerminalScreen.tsx`
- **Added** `OutputRow` component — mono font, left border, muted text — for PTY capture output lines
- **Updated** `EventRow` dispatcher to route `event_type === 'output'` to `OutputRow`
- **Added** `outputRow` and `outputText` styles

---

## What was NOT changed
- All existing approval flow (`hook.js`, `postHook.js`, `notifyHook.js`, `stopHook.js`) — untouched
- `heartbeat.js` — no changes needed; server filters pty_managed sessions automatically
- `WriteConsoleInput` injection path in `heartbeat.js` — kept as fallback for non-PTY sessions
- Push notifications, file browser, request history — untouched

---

## How to use

### Realtime (auto, no action needed)
Just restart the server. The mobile Terminal tab now receives events via push (~1s) with 30s polling fallback.

### PTY Sessions (new workflow)
1. Open the desktop Electron app
2. Toggle **Claude Code Interception** ON
3. The **PTY Sessions** card shows all detected active Claude sessions with their cwds
4. Click **Start** on any session (or **Start all**) — Claude resumes that conversation in a PTY
5. On mobile, open the **Terminal** tab — select the session to see live output stream

### Multiple sessions
Each detected session gets its own PTY process. All appear as separate session chips on the mobile Terminal tab. Start/Stop each independently from the dashboard.

---

## Known remaining items
- `SUPABASE_JWT_SECRET` in server `.env` is optional but makes `/realtime-token` faster (~0ms vs ~300ms). Get from Supabase → Settings → API → JWT Settings → Reveal.
- PTY output filter tuning: if too much noise appears on mobile, increase `FLUSH_MS` or tighten `SKIP_RE` in `pty-host.js`
- Consider adding a retention policy for `terminal_events`: `delete from terminal_events where created_at < now() - interval '7 days';`
- Remove `WriteConsoleInput` path from `heartbeat.js` once PTY mode is confirmed stable
