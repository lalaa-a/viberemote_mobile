# Terminal Feature — Implementation Changes

## Database (Supabase — run manually)

Create the `terminal_events` table before deploying server changes:

```sql
create table terminal_events (
  id          uuid primary key default gen_random_uuid(),
  session_id  text        not null,
  machine_id  uuid        not null references machines(id) on delete cascade,
  user_id     uuid        not null,
  event_type  text        not null,
  tool_name   text,
  summary     text,
  detail      text,
  status      text,
  created_at  timestamptz not null default now()
);

create index terminal_events_session_idx on terminal_events (session_id, created_at desc);
create index terminal_events_user_idx    on terminal_events (user_id, created_at desc);

alter table terminal_events enable row level security;
create policy "user reads own events"
  on terminal_events for select
  using (auth.uid() = user_id);
```

---

## Server (`D:\Projects\vibe_remote(serverside)`)

### `src/routes/relay.js`
**Added** `POST /relay/terminal-event` — receives lifecycle events from desktop hook scripts.
Inserts a row into `terminal_events` scoped to `machine_id` + `user_id`.

### `src/routes/mobile.js`
**Added** `GET /mobile/terminal?session_id=xxx&limit=60` — returns terminal events for the
authenticated user, filtered by optional `session_id`, oldest-first. Mobile polls this every 5s.

---

## Desktop (`D:\Projects\vibe_remote(dekstop)\my-app\relay-deamon1`)

### `src/supabase.js`
**Added** exported function `postTerminalEvent({ session_id, event_type, tool_name, summary, detail, status })`
— thin wrapper around `apiPost('/relay/terminal-event', ...)`.

### `hook.js` (PreToolUse — existing file)
**Added** fire-and-forget `postTerminalEvent` call after `uploadRequest` succeeds.
Posts a `tool_start` event so the mobile shows "pending approval" immediately.
Never awaited — does not affect the approval flow.

### `postHook.js` ← NEW FILE
PostToolUse hook. Parses tool result, builds a human-readable summary, posts a `tool_end`
event with `status: 'success' | 'error'` and up to 500 chars of Bash output as `detail`.

### `notifyHook.js` ← NEW FILE
Notification hook. Captures Claude's progress messages ("Searching...", "Analyzing...") and
posts them as `notification` events.

### `stopHook.js` ← NEW FILE
Stop hook. Fires when Claude finishes a task. Posts a `stop` event with Claude's own
result summary (up to 300 chars) or "Task finished" if no result.

### Hook registration — automatic via desktop app
Hooks are registered by the Electron app's toggle (same flow as before). When the user enables
mobile mode via the dashboard or `node relay.cjs mobile`, `buildHookBlock()` now writes all four
hooks into `~/.claude/settings.json` automatically. No manual settings.json editing needed.

---

## Mobile (`D:\Projects\vibe_remote(reactNative)\AgentControl`)

### `src/types/index.ts`
- **Changed** `TabParamList.HistoryTab` → `TabParamList.TerminalTab`
- **Added** `TerminalEvent` interface:
  ```ts
  { id, session_id, machine_id, event_type, tool_name, summary, detail, status, created_at }
  ```

### `src/api/server.ts`
**Added** `fetchTerminalEvents(sessionId?, limit)` — calls `GET /mobile/terminal`.

### `src/hooks/useTerminal.ts` ← NEW FILE
`useTerminalEvents(sessionId?)` hook — React Query, polls every 5s, stale after 3s.

### `src/screens/Terminal/spinnerWords.ts` ← NEW FILE
The 8 spinner words extracted from Claude Code's binary:
`Brewing, Canoodling, Cogitating, Cooking, Discombobulating, Noodling, Pondering, Ruminating`

### `src/screens/Terminal/TerminalScreen.tsx` ← NEW FILE
Full terminal screen with:
- Same header pattern as other tabs (Vibe Remote / Terminal / live dot)
- Horizontal session picker chips (auto-selects most recent active session)
- Session banner showing machine cwd + status
- FlatList of events:
  - `ToolRow` — colored icon box per tool, pending/done/error badge, optional Bash output preview
  - `NotificationRow` — italic Claude progress messages
  - `StopRow` — green finish indicator with Claude's summary
- `ThinkingRow` (ListFooterComponent) — animated pulsing dot + cycling spinner words when session is active

### `src/navigation/RootNavigator.tsx`
- **Removed** `HistoryScreen` import → **Added** `TerminalScreen` import
- **Changed** `TAB_META.HistoryTab` → `TAB_META.TerminalTab` with `terminal` / `terminal-outline` icons
- **Changed** `<Tab.Screen name="HistoryTab">` → `<Tab.Screen name="TerminalTab">`

---

## What was NOT changed

- `HistoryScreen.tsx` — file kept, just no longer mounted in the navigator
- `useHistory` hook — still used by `RequestsListScreen` for the Approved/Denied filter tabs
- All existing approval flow files (hook.js logic, supabase.js decision functions)
- Server auth middleware, push notifications, file browser routes
