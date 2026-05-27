# SSH/tmux vs. Vibe Remote — Honest Analysis

The other Claude's suggestions (SSH, tmux, Tailscale, code-server) are good answers to the *generic* question "how do I use Claude Code remotely." They're not the right answers for **what you're actually building.**

Your system isn't "remote terminal access." It's a **structured approval surface** with a mobile-native UX. They're different products that look superficially similar.

---

## What SSH/tmux actually gives you

| | SSH/tmux | Vibe Remote (current) |
|---|---|---|
| **Latency** | Instant (TCP stream) | 5–10s polling |
| **Live output** | Every character, byte-by-byte | Structured hook events only |
| **Approval workflow** | None — full shell access | Risk assessment, diffs, push notifications |
| **Mobile UX** | A terminal emulator on a 6" screen | Native gestures, scannable cards, glanceable status |
| **Setup** | SSH keys + Tailscale/port-forward | Scan a QR code |
| **Works through NAT** | Needs Tailscale or DDNS | Just works (server is the broker) |
| **Off-network** | Tailscale required | Works on cellular instantly |
| **Auth** | SSH keys (whole machine) | Per-machine API key (scoped) |
| **Multi-machine view** | One SSH session per machine | All your machines in one app |
| **Push notifications** | None | Native FCM |
| **Risk model** | "you have a shell, good luck" | Risk-rated approval gates |

**SSH wins on:** latency, raw output fidelity, "I want everything Claude printed."
**You win on:** every other axis that matters for the actual use case ("approve sensitive operations from my phone without being chained to my desk").

---

## The honest gap: live narrative output

SSH/tmux is right about **one** thing: your system currently has a blind spot.

Claude Code prints a *lot* between tool calls — its reasoning narrative, file searches, "I'm now going to..." preambles. None of it fires a hook. So your mobile feed shows:

```
Bash: npm test → done
[silence for 40 seconds while Claude reasons]
Edit: src/foo.ts → done
```

When in the terminal you'd see Claude monologuing the whole time. The new Terminal tab partially closes this with `Notification` hook events + spinner words, but it's still **events**, not a **stream**.

---

## What's worth borrowing — concrete proposals

### 1. PTY capture on the desktop (high value, medium effort)

Instead of *just* relying on Claude Code's hooks, wrap Claude Code in a PTY (`node-pty`) on the desktop side. The PTY gives you the raw character stream — every "Cogitating...", every status line.

Filter aggressively (strip ANSI, debounce, summarize) and ship a *sampled* version to the server as `terminal_output` events. Mobile renders them as italic gray lines between the structured events.

This is the closest thing to "watch Claude work" on mobile. You keep all your structured approval UI; the PTY stream is decoration.

**Cost:** node-pty is a native dep, adds Windows packaging headache. The filtering is the hard part — you do *not* want to upload 50KB/s of terminal output to Supabase.

### 2. Realtime channel for the active session (low effort, high feel)

Polling at 5–10s is fine for the request list, but the Terminal tab feels stale. Use **Supabase Realtime** on `terminal_events` for the *one* session the user is currently viewing. Drop back to polling when the tab is backgrounded.

This is a 30-line change and makes the Terminal tab feel like SSH without being SSH.

You already use Realtime on `pending_requests` from the desktop side — this is the same pattern in the mobile direction.

### 3. Replace `WriteConsoleInput` prompt injection (medium value)

Your current prompt delivery is `heartbeat.js → WriteConsoleInput`. It's clever but fragile — it depends on the terminal having focus, the right encoding, no race conditions.

SSH/tmux gets this for free: there's a real TTY, you write to it.

If you go the PTY-capture route in #1, you already *have* a TTY. Injection becomes `pty.write(prompt + '\r')` — bulletproof, no PowerShell scripts, no focus dance. You'd get this for free as a side effect.

### 4. Tailscale-aware mode (low value)

Their Tailscale suggestion is interesting only as a **transport option for users who already have it**: detect Tailscale's interface, prefer it for the server connection. Lower latency, but the server is still the broker. Probably not worth building for most users.

---

## What to NOT borrow

- **"Just open a terminal on mobile"** — this is what code-server/Termius are. They're worse mobile UX than what you have. A horizontal-scroll-only 80-column terminal on a phone is bad. You already won this fight.
- **SSH-style auth** — your QR-pairing flow is *better* mobile UX. Don't go backward to keys-in-a-file.
- **"Just use Tailscale"** — adds a setup step. Your QR pairing is the moat. Don't break it.

---

## Where to spend effort, in order

1. **Realtime on `terminal_events`** for the currently-viewed session. (1 day, immediately better feel.)
2. **PTY capture + sampled output stream** as a new event type. (1 week, but this is the feature.)
3. **Replace WriteConsoleInput with `pty.write`** as a side effect of #2. (Comes for free.)
4. **Ignore** Tailscale/SSH integration — it's a different product.

---

## TL;DR

The SSH/tmux response is "use the standard tool." Your system **is the better tool** for this specific job — you've just got one missing feature (live narrative output between tool calls). Steal the PTY idea, ignore the rest. Don't apologize for not being a terminal app; that's the point.
