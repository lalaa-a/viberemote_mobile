# Toggle-only flow — what changed

**Supersedes** `SESSION_CHANGES.md`, `IMPROVEMENTS_DONE.md`, and `IMPROVEMENTS_IMPLEMENTATION.md` for the PTY parts of those documents. The Realtime / OutputRow / mobile event-type pieces still apply.

The previous PTY-based approach was the wrong design — it required the user to start Claude *through* the desktop app, forced them to manage sessions manually, and left orphaned `pty-host` processes when interception was toggled off.

**New design — one toggle, no manual session work:**

1. User opens their own terminal, runs `claude` as they always do
2. User flips the **Claude Code Interception** toggle in the Electron app
3. Everything flows through that one existing Claude CLI session:
   - Tool approvals → mobile (existing hook flow, unchanged)
   - Claude's narrative reasoning between tool calls → mobile (new transcript watcher)
   - Prompts sent from mobile → injected back into the same Claude CLI (existing `WriteConsoleInput` flow)
4. User toggles off → hooks removed from `~/.claude/settings.json`, transcript mappings age out, the CLI session continues running normally with zero residue

---

## Changes by codebase

### Mobile — `D:\Projects\vibe_remote(reactNative)\AgentControl`
**Unchanged.** Keeps `OutputRow`, `'output'` event type, Realtime subscription, all from earlier work. Mobile is already correct for the new flow.

---

### Server — `D:\Projects\vibe_remote(serverside)`

#### `src/routes/mobile.js`
- **Removed** the `?session_id` query param branch from `GET /mobile/command/next`
- **Removed** the `.neq('pty_managed', true)` filter that broke prompt delivery when the column didn't exist on `agents`. **This was the root cause of "prompt back not working" — fixed now.**

#### `src/routes/relay.js`
- **Removed** `GET /relay/sessions` (Dashboard no longer needs to discover sessions)
- **Removed** `POST /relay/agent-update` (no PTY processes to mark)

The `pty_managed` column on `agents`, if present from an earlier migration, is now ignored everywhere. It is safe to leave; no need to drop it.

---

### Desktop — `D:\Projects\vibe_remote(dekstop)\my-app`

#### `relay-deamon1/src/pty-host.js` ← **DELETED**
#### `relay-deamon1/package.json`
- **Removed** `node-pty` dependency (ran `npm uninstall node-pty`)

#### `src/main.js`
- **Removed** all `pty:start` / `pty:stop` / `pty:sendPrompt` / `pty:list` IPC handlers
- **Removed** the `ptyProcs` Map and the `relay:getSessions` IPC handler

#### `src/preload.js`
- **Removed** `window.relay.pty.*` bridge and `window.relay.getSessions`

#### `src/components/Dashboard.jsx`
- **Removed** all PTY-related state, helper functions, and the entire "PTY Sessions" card
- **Restored** `toggleHook()` to its simple "flip the hook in settings.json" behavior
- Updated the interception card description to explain the full flow (approvals + reasoning + injection in one toggle)

---

### Desktop — `relay-deamon1/` hooks

#### `hook.js` (PreToolUse)
- **Added** `recordTranscriptPath(sessionId, transcriptPath)` — writes the transcript path to `C:\temp\transcript-paths\<session-id>.path` on every hook fire. The mtime serves as a heartbeat: stale mapping files signal "interception is off" so the watcher stops tailing them.
- Called immediately after `storeClaudePid()`. The hook always receives `transcript_path` from Claude Code.

#### `postHook.js` (PostToolUse), `notifyHook.js` (Notification)
- Same `recordTranscriptPath` helper, called at the start. Keeps the mapping mtime fresh between tool calls (Notification fires for Claude's "Searching...", "Analyzing..." messages roughly every few seconds during active work).

#### `stopHook.js` (Stop)
- Deletes the mapping file on session end (`unlink C:\temp\transcript-paths\<session-id>.path`). Clean shutdown.

---

### Desktop — `relay-deamon1/scripts/heartbeat.js`

**New transcript watcher loop (3-second interval):**

```
~/.claude/projects/<encoded-cwd>/<session-id>.jsonl
                                      ↑
       (each session's transcript, written line-by-line by Claude Code)
```

- Reads all mapping files in `C:\temp\transcript-paths\`
- Skips mappings whose mtime is older than 5 minutes (interception toggled off → watcher pauses automatically; no IPC needed)
- For each fresh mapping, tracks a byte offset per session and reads only new bytes since last tick
- Parses complete JSONL lines (partial trailing line is held for the next tick)
- For each `entry.type === 'assistant'` entry, walks `entry.message.content`, picks `text` blocks, posts them as `terminal_events` with `event_type: 'output'`
- Tool uses / tool results are **skipped** — `PostToolUse` already covers those, no need to duplicate
- On first sight of a session, jumps to current end-of-file so we don't replay old conversation history

This loop runs alongside the existing three: machine heartbeat (30s), prompt delivery (10s), file-tree requests (5s).

---

## How a full round-trip looks now

```
User terminal:                                    Mobile:
$ claude
> help me refactor the auth module                            (user types in CLI)
  …Claude starts reasoning…                  →   "Cogitating..." (Notification hook)
  …Claude's text content...                  →   italic output row (transcript watcher)
  Wants to Read auth.ts                      →   approval card (PreToolUse hook)
                                                 [user taps Approve]
  ← exit 0 (approved)                        ←   /mobile/decide
  Read complete                              →   tool_end row (PostToolUse hook)
  …more reasoning…                           →   italic output row (transcript watcher)
  Wants to Edit auth.ts                      →   approval card
                                                 [user taps Approve]
  ← exit 0
  Edit complete                              →   tool_end row
  Task finished                              →   stop row (Stop hook)
                                                 [user types new prompt on mobile]
                                             ←   /mobile/prompt
  > "now run the tests"                      ←   heartbeat picks up command,
                                                 WriteConsoleInput injects into
                                                 Claude's existing CLI
  …Claude runs tests…                        (loop continues)
```

Toggle off at any point: hooks are removed from `settings.json`, mappings age out within 5 minutes, the user's Claude CLI session continues working without any change.

---

## Manual steps required

**None for the toggle-only flow.** The earlier `SQL alter publication ... add table terminal_events` is still required for Realtime push (from earlier work), but is unrelated to today's changes.

The `pty_managed` column on `agents` is no longer used — leave it or drop it, either works.

---

## Why this works better than PTY

| | PTY approach (removed) | Toggle-only (current) |
|---|---|---|
| Manual setup per session | Yes (cwd input, Start button) | None |
| Multiple concurrent sessions | Multiple PTY processes to manage | All handled by the same Claude CLIs the user already has open |
| Toggle off → cleanup | Orphaned PTY processes | Hooks removed; CLI continues normally |
| Captures narrative output | Yes, via PTY stdout | Yes, via JSONL transcript |
| Captures tool approvals | Same hook flow | Same hook flow |
| Native deps | `node-pty` (Windows build issues) | None |
| Latency | ~250ms PTY debounce + 1s realtime | ~3s transcript poll + 1s realtime |

The 3-second polling interval on the transcript is the only concession — slightly higher latency than the PTY had on raw output. In practice it's invisible because Realtime pushes events to the mobile in ~1s once they hit the server, and Claude's narrative blocks are typically multi-second writes anyway.
