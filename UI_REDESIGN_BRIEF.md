# Vibe Remote — UI Redesign Brief

This document lists every screen, component, and design token in the app.
For each item, describe how you want it to look and feed it back.
You don't need to cover everything at once — you can do one section at a time.

---

## 1. Global Design Tokens

These apply everywhere. Define them first — everything else references them.

### 1.1 Color Palette
Define named colors for:
- `bg` — main screen background
- `surface` — cards, inputs, secondary containers
- `border` — 1px dividers and card outlines
- `textPrimary` — headings, main labels
- `textSecondary` — body copy, descriptions
- `textTertiary` — timestamps, metadata, placeholders
- `accent` — primary action color (buttons, links, active tabs)
- `accentDeep` — pressed/darker accent
- `accentLight` — tinted accent backgrounds (chips, banners)
- `danger` — destructive actions, Deny button, errors
- `dangerLight` — danger background tint
- `warning` — medium-risk, idle state
- `success` — approved state, online dot
- `successDark` — deep success for text on light backgrounds
- `info` — informational state
- `codeBg` — background for code/terminal blocks (usually dark)
- `white`, `black`

**Risk tier colors** (4 levels, each needs `bg`, `text`, `border`, `strip`):
- `low` — safe operations
- `medium` — moderate risk
- `high` — high risk
- `critical` — destructive / irreversible

**Tool type badge colors** (each needs `bg`, `text`, `dot`):
- `Bash` — shell command execution
- `Write` — creates new files
- `Edit` — edits existing files
- `MultiEdit` — edits multiple files simultaneously
- `unknown` — fallback

**Tab bar colors:**
- `tabActive` — active tab icon/label
- `tabInactive` — inactive tab icon

### 1.2 Typography
Specify font sizes and weights for each role:
- `screenTitle` — main screen heading (e.g. "Requests")
- `cardTitle` — card / section heading
- `body` — normal paragraph text
- `label` — buttons, tab labels, chip text
- `metadata` — timestamps, machine names, byte counts
- `mono` — command text, file paths, code

### 1.3 Spacing Scale
Define step values (current: 4 / 8 / 12 / 16 / 20 / 24 / 32 px).

### 1.4 Border Radius Scale
Define values for:
- `xs` — tight (inline chips)
- `sm` — inputs, small buttons
- `md` — cards, code blocks
- `lg` — large cards
- `xl` — sheets, modals
- `full` — pills

### 1.5 Shadow / Elevation
Two types:
- `card` — current spec: **no shadow**, border only
- `float` — floating tab bar: deep drop shadow
- `modal` — bottom sheet: lighter shadow

---

## 2. Navigation — Bottom Tab Bar

**Purpose:** persistent navigation between the 4 main sections.
**Position:** floating, over the content (currently 64px pill, screen-width minus 48px).
**Tabs (in order):**
1. **Requests** — icon: bell — shows badge count of pending requests (red)
2. **Sessions** — icon: flash — shows badge count of active sessions (green)
3. **Machines** — icon: server — no badge
4. **History** — icon: clock — no badge

**Active tab state:** expanded chip with icon + label text, animated spring on focus.
**Inactive tab state:** icon only.
**Badge:** small circle top-right of the tab icon showing a number.

**What to specify:**
- Container shape (pill / rounded rect / full-width bar)
- Background (solid / blurred glass / translucent)
- Height, horizontal margin
- Active tab appearance
- Inactive tab appearance
- Badge styling
- Shadow / border

---

## 3. Screens

---

### 3.1 QR Scan Screen (Login)

**When shown:** first launch, before the user has paired any machine.
**Purpose:** user scans a QR code from the desktop app to authenticate.

**States:**
- **No permission** — camera not granted yet. Shows: logo, title, description, "Grant camera access" button.
- **Scanning** — camera live. Shows: logo + title at top, scan frame in center, status pill at bottom.
- **Connecting** — QR detected, verifying. Shows: spinner inside scan frame, "Connecting…" status.
- **Connected** — success. Brackets turn green, status pill shows "Connected!", then navigates away.
- **Error** — connection failed. Alert dialog with "Try again".

**Elements to design:**
- **Logo box** — 52×52 square, currently shows "VR" initials in accent color
- **Title** — "Vibe Remote"
- **Subtitle** — instruction text
- **Scan frame** — 240×240 area with animated corner brackets
- **Corner brackets** — 4 corners, pulse when scanning, turn green on success
- **Spinner** — shown during connection attempt
- **Status pill** — rounded pill at bottom showing current status message
- **Background** — camera feed behind dark overlay
- **Top overlay** — dark band over camera for logo/title readability
- **Bottom overlay** — dark band for status pill
- **"Grant camera" button** — shown only on no-permission state

---

### 3.2 Requests List Screen

**Tab:** Requests (tab 1)
**Purpose:** shows all tool-use requests Claude Code is making, waiting for user approval.

**Header area:**
- **Title** — "Requests"
- **Subtitle** — "N pending approval" or "No pending requests"
- **Live indicator** — small "↻ live" label (data refreshes every 8s)

**Segmented control** (3 segments, switches the list below):
- **Pending** — requests waiting for decision (with count badge)
- **Approved** — decided as approved (with count badge)
- **Denied** — decided as denied (with count badge)

**List:**
- Items are **RequestCard** components (see Section 4.1)
- Pulls to refresh
- Empty state when no items (see below)

**Loading state (skeleton):**
- 3 placeholder cards while data loads
- Shimmer / pulse animation on placeholders

**Empty state:**
- Icon (currently `checkmark-circle-outline`)
- Title: "All clear" / "No approved yet" / "None denied"
- Subtitle: explanatory text

---

### 3.3 Request Detail Screen

**Reached from:** tapping a RequestCard anywhere in the app.
**Purpose:** full view of a single tool-use request. User approves or denies here.

**Header card** (white card at top):
- **Tool name** — large, e.g. "Bash", "Edit", "Write"
- **Risk badge** — see Section 4.2
- **Summary** — 1–2 sentence description of what Claude wants to do
- **Info row** (3 columns side by side):
  - MACHINE — machine label with online/offline dot
  - RISK — risk reason text
  - TIME — "X minutes ago"

**Bash command block** (only for Bash tool):
- Dark background (`#1C1C1E`)
- `$` prefix in gray
- Command text in light color, horizontally scrollable

**Files section** (for Edit/Write tools):
- Title: "FILES  N"
- List of affected file paths, each row with small file icon

**Diff section** (for Edit/Write with diffs):
- Title: "CHANGES  +N  −N"
- **DiffViewer** component — see Section 4.3

**Decision banner** (shown if already decided):
- Checkmark + "Approved" or X + "Denied"
- Background tinted by decision (green or red)

**Sticky footer** (shown if still pending):
- **Deny button** — outline border, danger color, 48px height
- **Approve button** — filled accent, 56px height (larger = more prominent)
- Shadow above footer
- iOS home indicator padding

---

### 3.4 Sessions Screen

**Tab:** Sessions (tab 2)
**Purpose:** lists all active Claude Code agent sessions across all machines.

**Header area:**
- **Title** — "Sessions"
- **Subtitle** — "N active" or "No active sessions"
- **Live indicator** — "↻ live"

**Session cards** (one per session):
- **Left accent strip** — colored by status (green/yellow/gray, 4px wide)
- **Status dot** — pulsing animated dot for active sessions
- **Machine label** — which machine this session is on
- **Status badge** — pill: "Active" / "Idle" / "Finished"
- **CWD** — current working directory path (monospace)
- **Meta** — pending count (in danger color) + last seen time
- **Prompt button** — disabled if approvals pending, shows "Approvals pending…"
- **Detail button** — "Detail →" outline button

**Empty state:**
- Icon (`flash-outline`)
- Title: "No sessions"
- Subtitle with code inline (`hook.js`)

---

### 3.5 Session Detail Screen

**Reached from:** tapping "Detail →" on a session card.
**Purpose:** view all pending requests + sent prompts for one specific session.

**Header bar** (replaces nav header on this screen):
- **CWD** — monospace path
- **Machine name** — below CWD, tertiary color
- **Files button** — outline, opens FileBrowser; disabled + "Offline" when machine is offline
- **Prompt button** — filled accent, opens PromptCompose

**Section list** (two sections):

**Section 1 — PENDING REQUESTS (N)**
- Lists **RequestCard** components (swipeable, same as list screen)
- Empty state: "No pending requests"

**Section 2 — SENT PROMPTS**
- Each row shows:
  - Status icon (`hourglass-outline` / `checkmark-circle` / `close-circle`)
  - Prompt text (2 lines max)
  - Status + time metadata
  - **Cancel button** (only on pending prompts)
- Empty state: "No prompts sent yet"

---

### 3.6 File Browser Screen

**Reached from:** "Files" button in Session Detail header.
**Purpose:** browse the file/directory tree of a remote machine.

**Path bar** (top):
- Current directory path (monospace)
- Loading spinner (right side, when fetching)

**Tree list:**
Each row shows:
- **Expand/collapse icon** — `chevron-down` / `chevron-forward` for dirs; `document-outline` for files
- **Name** — dirs are bold + accent color; files are regular + primary text
- **Loading spinner** — on a dir being fetched
- **File size** — right-aligned for files (e.g. "4.2 KB")
- **"tap to load" hint** — on unloaded dirs
- Indented per depth level (16px per level)

**Long-press action:**
- Alert with path + "Use in prompt" option (navigates to PromptCompose with prefill)

**Error state:**
- Error message + "Retry" button

**Loading state:**
- Full-screen spinner + "Loading file tree…"

**Hint bar** (bottom):
- "Long-press any item → use path in prompt"

---

### 3.7 Prompt Compose Screen

**Reached from:** "Prompt" button in Sessions or Session Detail.
**Presentation:** bottom sheet modal (slides up over other content).

**Elements:**
- **Handle bar** — small pill at top center of sheet
- **Title** — "Send prompt"
- **Subtitle** — "Delivered when Claude is idle with no pending approvals."
- **Template chips** (horizontal scroll row, 4 chips):
  - Refactor
  - Add tests
  - Fix bug
  - Explain
  - (Tapping appends template text to the input)
- **Text input** — multiline, min 120px, max 260px, auto-focus
- **Footer row:**
  - Character count — "N/2000"
  - Cancel button — outline
  - Send button — filled accent, disabled when empty

---

### 3.8 Machines Screen

**Tab:** Machines (tab 3)
**Purpose:** shows all registered machines and their online/offline status.

**Header:**
- **Title** — "Machines"
- **Subtitle** — "N online · N offline"
- **Disconnect button** — top-right, danger outline color, small

**Machine cards** (one per machine):
- **Status dot** — green (online) / gray (offline), 10px circle
- **Machine label** — display name
- **Machine ID** — monospace, truncated, tertiary color
- **Status badge** — pill: "Online" (green tint) / "Offline" (surface)
- **Last seen** — "X minutes ago"

**Empty state:**
- Title: "No machines registered"
- Subtitle with inline code: `node scripts/setup.js`

---

### 3.9 History Screen

**Tab:** History (tab 4)
**Purpose:** log of all past approved/denied requests.

**Header:**
- **Title** — "History"
- **Subtitle** — "N decisions"

**Filter chips** (horizontal scroll, two groups separated by a divider):
- Group 1: All / Approved (N) / Denied (N)
- Group 2: Bash (N) / File Edit (N)
- Active chip: filled accent background + white text

**Dense list** (no card backgrounds — rows only):
Each row:
- **Icon box** — 36×36, tinted bg, icon inside:
  - approved → `checkmark-circle` (green)
  - denied → `close-circle` (red)
  - timeout → `time-outline` (orange)
  - cli_pending → `terminal-outline` (gray)
  - pending → `ellipsis-horizontal` (blue)
- **Tool name** — left, semibold
- **Status label** — right, colored
- **Summary** — truncated to 1 line
- **Machine** — left, tertiary
- **Time** — right, tertiary

**Empty state:**
- Title: "No history yet" or "No matches"
- Subtitle text

---

## 4. Shared Components

---

### 4.1 RequestCard

**Used in:** Requests List, Session Detail (pending section)
**Purpose:** a single row representing one tool-use request awaiting or past a decision.

**Swipe gestures** (only when status is `pending`):
- Swipe **right** → green **Approve** action panel revealed on left
- Swipe **left** → red **Deny** action panel revealed on right
- Tap action panel button → fires decision, closes swipe

**Elements:**
- **Left color strip** — 4px vertical strip, color matches risk level
- **Tool dot** — 7px circle, color matches tool type
- **Tool name** — e.g. "Bash", "Edit"
- **CLI tag** — small pill "CLI" shown when status is `cli_pending`
- **Risk badge** — see Section 4.2
- **Summary** — 2 lines max
- **File chips** — up to 2 filename pills (showing just the filename, not full path), "+ N more" if >2
- **Machine online dot** — 5px circle, green = online, gray = offline
- **Machine name** — tertiary text
- **Timestamp** — "X minutes ago", right-aligned

**Approve action panel** (swipe right):
- Background: accent green
- Checkmark icon + "Approve" label

**Deny action panel** (swipe left):
- Background: danger red
- X icon + "Deny" label

---

### 4.2 RiskBadge

**Used in:** RequestCard, Request Detail header
**Purpose:** small pill label showing the risk level of a request.

**4 levels:**
- **Low** — green tint
- **Medium** — amber tint
- **High** — orange tint
- **Critical** — red tint

**Each level has:** background color, text color, border color.
**Optional icon** (`showIcon` prop) — small icon to the left of the label text:
- low → `checkmark`
- medium → `alert-outline`
- high → `alert`
- critical → `close`

---

### 4.3 DiffViewer

**Used in:** Request Detail screen
**Purpose:** displays file diff (added/removed/unchanged lines) for Edit and Write tool requests.

**Container:** dark background (`#1C1C1E`), rounded.

**If multiple files:** collapsible file sections, each with:
- File header bar (dark, slightly lighter than container)
  - File path (monospace, light)
  - "NEW FILE" badge (if applicable)
  - `+N` added count (green)
  - `-N` removed count (red)
  - Expand/collapse chevron icon
- **Content** (when expanded): horizontally scrollable

**Each line:**
- `+` added — green tinted background, green text
- `-` removed — red tinted background, red text
- Context — transparent background, gray text
- Each line has: line number column (dimmed) + content

**Stats row** (top of multi-file viewer):
- "N files changed  +N additions  −N deletions"

---

## 5. How to Provide Your Redesign

For each item above, describe:

```
### [Item Name]

**Layout:** [describe the layout / structure]
**Colors:** [which tokens or hex values to use]
**Typography:** [font sizes, weights]
**Spacing:** [padding, margins, gaps]
**Borders/Radius:** [border style, corner radius]
**Shadows:** [yes/no, describe]
**Animations:** [any motion, transitions]
**States:** [how each state looks: loading, empty, error, active, disabled]
**Notes:** [anything else — hierarchy, emphasis, feel]
```

You can also describe using plain English or ASCII diagrams.
Cover as many or as few items as you want per prompt — I'll implement each batch.
