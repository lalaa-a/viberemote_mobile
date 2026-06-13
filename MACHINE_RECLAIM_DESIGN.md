# Machine Reclaim on First-Run

## The Problem

Every time a user installs the desktop app, `Dashboard.jsx` generates a new random UUID and calls
`POST /machines/register`. This creates a new machine row in the database regardless of whether
one already exists for that account on that PC.

The result: after an uninstall/reinstall (or even signing out and back in with no `.env`), the
user gets a fresh machine with no history. Their old machine — with all its sessions, pending
requests and agent history — is orphaned. It still appears on mobile under the account, pointing
at credentials that no longer exist anywhere.

**Why it keeps happening:**
- `machineId` is `crypto.randomUUID()` — new every time
- The only persistence is the `.env` file inside `relay-deamon1/`, which is wiped on uninstall
- There is no fallback to look up existing machines

---

## Why Not Hardware Fingerprinting

The obvious shortcut is to derive `machineId` from hardware (CPU serial, MAC address, hostname
hash). Don't.

- **Breaks on reinstalls**: OS reinstalls reset half these identifiers
- **Breaks on VMs / cloud**: cloned images share fingerprints
- **Privacy**: hardware IDs are a tracking vector; users expect app data to be separate
- **Doesn't solve multi-machine**: user legitimately has two PCs; fingerprinting gives no way to
  pick which history to restore

Hardware fingerprinting is the wrong layer. Identity belongs in user intent, not hardware state.

---

## Why Not Silent Auto-Reclaim

We could compare `os.hostname()` against existing machine labels and silently re-key the match.

Don't do this either. Silent credential rotation on an active machine is dangerous:
- Another instance of the heartbeat could be running on the same PC under the old key
- Both instances would race, the old key is invalidated mid-run, and the daemon crashes
- User has no idea why

The user must explicitly choose to reclaim.

---

## Proposed Design: Machine Selector on First-Run

### When it triggers

Only when `window.relay.getMachineConfig()` returns `null` — i.e., no `.env` exists. Existing
users with a working config are unaffected. This is purely a first-run/reinstall path.

### Flow

```
User signs in
     │
     ▼
GET /user/machines  (user JWT Bearer token)
     │
     ├─── no machines ──────────────────► registerMachine() [current behaviour]
     │
     └─── machines exist
               │
               ▼
         MachineSelector dialog
         ┌─────────────────────────────────────────┐
         │  ⬡ Vibe Remote                          │
         │                                         │
         │  We found machines registered to your   │
         │  account. Pick one to restore its        │
         │  history, or register this as a new one. │
         │                                         │
         │  ▶ WORK-PC-2024  (this hostname)        │  ← auto-highlighted
         │    Last seen 3 days ago · Offline        │
         │    [Reclaim]  [Delete]                   │
         │                                         │
         │    OLD-LAPTOP                            │
         │    Last seen 2 months ago · Offline      │
         │    [Reclaim]  [Delete]                   │
         │                                         │
         │  ─────────────────────────────────────  │
         │  [+ Register as new machine]             │
         └─────────────────────────────────────────┘
               │
     ┌─────────┴──────────┐
     ▼                    ▼
  Reclaim               New machine
POST /machines/        POST /machines/
reclaim/:machineId     register
     │                    │
     ▼                    ▼
  Gets new raw key    Gets new raw key
  Same machine_id     New machine_id
  All history intact  Fresh start
     │                    │
     └──────┬─────────────┘
            ▼
      write relay-deamon1/.env
      start heartbeat
      render Dashboard
```

### Hostname auto-highlight

After fetching the machine list, compare `os.hostname()` against each machine's `label` field
(which was set from `os.hostname()` at registration time). Highlight the match visually and move
it to the top. No auto-selection — just surfacing the most likely candidate.

---

## Server Changes

### New endpoint: `GET /user/machines`

Authenticated by Supabase user JWT (Bearer token), the same auth the desktop already uses for
`POST /machines/register`.

```js
// GET /user/machines — list all machines for the signed-in user
router.get('/machines', requireUserAuth, async (req, res) => {
  const { data, error } = await db
    .from('machines')
    .select('id, label, is_online, last_seen, created_at')
    .eq('user_id', req.user.id)
    .order('last_seen', { ascending: false, nullsFirst: false })

  if (error) return res.status(500).json({ error: 'Failed to fetch machines' })

  const now = Date.now()
  res.json((data ?? []).map(m => ({
    ...m,
    is_online: m.last_seen
      ? (now - new Date(m.last_seen).getTime()) < 90_000
      : false,
  })))
})
```

This lives in `src/routes/machines.js`. The `requireUserAuth` middleware already exists for
`POST /machines/register` — reuse it.

### New endpoint: `POST /machines/reclaim/:machineId`

Also authenticated by user JWT. Verifies ownership, generates a new API key hash, writes it,
returns the raw key.

```js
// POST /machines/reclaim/:machineId
router.post('/reclaim/:machineId', requireUserAuth, async (req, res) => {
  const { machineId } = req.params

  // Ownership check — user can only reclaim their own machines
  const { data: machine, error: fetchErr } = await db
    .from('machines')
    .select('id, user_id')
    .eq('id', machineId)
    .single()

  if (fetchErr || !machine) return res.status(404).json({ error: 'Machine not found' })
  if (machine.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

  // Generate a new key — old key is gone, we can't recover it, so we re-issue
  const { rawKey, apiKeyHash } = await generateApiKey()  // same helper used by /register

  const { error: updateErr } = await db
    .from('machines')
    .update({
      api_key_hash: apiKeyHash,
      is_online:    false,
      last_seen:    null,
    })
    .eq('id', machineId)

  if (updateErr) return res.status(500).json({ error: 'Reclaim failed' })

  // rawKey returned once — only the hash is stored server-side, same as register
  res.json({ ok: true, rawKey })
})
```

Resetting `last_seen` to null and `is_online` to false is intentional: the old heartbeat is dead,
so the machine should appear offline until the new instance sends its first heartbeat.

### New endpoint: `DELETE /user/machines/:machineId`

For deleting ghost machines from the selector UI.

```js
router.delete('/machines/:machineId', requireUserAuth, async (req, res) => {
  const { data: machine } = await db
    .from('machines').select('user_id').eq('id', req.params.machineId).single()

  if (!machine || machine.user_id !== req.user.id)
    return res.status(403).json({ error: 'Forbidden' })

  await db.from('machines').delete().eq('id', req.params.machineId)
  res.json({ ok: true })
})
```

---

## Desktop (Electron) Changes

### `Dashboard.jsx` — `initMachine()` refactor

```js
async function initMachine() {
  setSetupLoading(true)
  try {
    // 1. Already configured — nothing to do
    const config = await window.relay.getMachineConfig()
    if (config?.machineId) {
      setMachineConfig(config)
      setHookEnabled(await window.relay.getHookStatus())
      setSetupLoading(false)
      return
    }

    // 2. First run — check for existing machines
    const { data: { session: s } } = await supabase.auth.getSession()
    const res = await fetch(`${API_URL}/user/machines`, {
      headers: { Authorization: `Bearer ${s.access_token}` },
    })
    const existing = res.ok ? await res.json() : []

    if (existing.length > 0) {
      // Defer to selector — renders MachineSelector component
      setExistingMachines(existing)
      setSetupLoading(false)
      return
    }

    // 3. No existing machines — register fresh
    await registerMachine(s)
    setHookEnabled(await window.relay.getHookStatus())
  } catch (err) {
    setError(err.message)
  }
  setSetupLoading(false)
}
```

### New `MachineSelector` component

Rendered by `Dashboard` when `existingMachines.length > 0`. On "Reclaim":
1. `POST /machines/reclaim/:machineId` with user JWT
2. Write `.env` with same keys as `registerMachine()` but using the returned `rawKey` and the
   existing `machineId`
3. Call `window.relay.writeMachineConfig(...)` → triggers heartbeat start

On "Register as new machine":
- Calls `registerMachine()` as before

On "Delete":
- `DELETE /user/machines/:machineId`
- Removes from the displayed list

---

## What Reclaim Preserves vs Resets

| Data              | After Reclaim  | Reason                                      |
|-------------------|----------------|---------------------------------------------|
| Sessions          | ✅ Preserved   | `agents` table joins on `machine_id`        |
| Pending requests  | ✅ Preserved   | `pending_requests` joins on `machine_id`    |
| History           | ✅ Preserved   | same                                        |
| API key           | 🔄 Re-issued   | old key is lost — only the hash was stored  |
| Online status     | ↩ Reset false  | old heartbeat is dead                       |
| Last seen         | ↩ Reset null   | same                                        |
| Mobile QR session | ❌ Invalidated | mobile needs to re-scan QR with new key     |

Mobile re-scan is unavoidable and acceptable — it's the same ask as initial setup, and the user
is in the desktop app specifically to re-pair.

---

## What This Does Not Solve

- **Multiple simultaneous machines**: a user with a desktop and a laptop should register two
  separate machines and keep them separate. This design supports that — "Register as new machine"
  is always available.
- **Automatic cloud backup of the API key**: the raw key is intentionally ephemeral. If we stored
  it server-side (even encrypted), the architecture promise ("service key never leaves VPS") would
  need re-evaluation.

---

## Implementation Order

1. Server: `GET /user/machines` and `POST /machines/reclaim/:machineId` + `DELETE` endpoint
2. Desktop: `MachineSelector` component (pure UI, no IPC needed — uses fetch directly)
3. Desktop: refactor `initMachine()` to branch on existing machines
4. Test: reinstall scenario end-to-end (history survives, QR re-scan works, heartbeat restarts)
