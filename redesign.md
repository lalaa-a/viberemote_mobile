# Vibe Remote — UI System & 2026 Redesign Prompt
### Editorial Warm Direction · *Terracotta · Serif · Glass-on-Gradient*

> **One-line brief:** Redesign Vibe Remote — a mobile control panel where developers approve or deny risky tool-use requests from a Claude Code agent — as a calm, editorial, magazine-grade product. Light theme, warm terracotta-to-cream gradient sky, frosted glass cards, large serif headlines, soft 3D clay iconography, exactly one black ink pill CTA per screen.

---

## How to use this document

1. Read **Part A** (component inventory) so you know the surface area.
2. Read **Part B** (design system) — these are the rules.
3. Read **Part C** (the worked example: *Requests List Screen*) — this is the calibration target. Match its rigor everywhere.
4. Generate each screen / component using **Part D's per-screen recipes** and the **Part E output template**.
5. Self-check against **Part F's North-Star checklist** before finalizing each screen.

---

## PART A — Component Inventory

### A1. Foundation tokens
- **Color tokens (semantic):** `bgGradientTop`, `bgGradientBottom`, `bgGrain`, `cream`, `creamDeep`, `surface`, `surfaceGlass`, `surfaceGlassStrong`, `border`, `borderGlass`, `borderHairline`, `textPrimary`, `textSecondary`, `textTertiary`, `textInverse`, `accentEmber`, `accentEmberDeep`, `accentEmberLight`, `inkBlack`, `inkBlackHover`, `danger`, `dangerLight`, `warning`, `success`, `successDark`, `info`, `codeBg`, `codeBgRaised`, `codeText`, `focusRing`
- **Risk tier palettes** (×4 — `low / medium / high / critical`) → `bg`, `text`, `border`, `dot`, `whisper` (ultra-low-alpha tint for card top fade)
- **Tool-type palettes** (×5 — `Bash / Write / Edit / MultiEdit / unknown`) → `bg`, `text`, `dot`, `clayIconId`
- **Tab palette:** `tabActive`, `tabInactive`, `tabSurfaceGlass`, `tabBadgeRequests`, `tabBadgeSessions`
- **Typography roles:** `displayXL`, `displayL`, `displayM`, `cardTitle`, `body`, `bodyEmphasis`, `label`, `labelStrong`, `metadata`, `mono`, `monoSmall`, `microLabel`
- **Spacing scale:** `0 / 2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 56`
- **Radius scale:** `xs 8 · sm 12 · md 16 · lg 22 · xl 28 · 2xl 36 · full 999`
- **Elevation tokens:** `flat`, `glassLow`, `glassHigh`, `inkPill`, `nestedDark`
- **Blur tokens:** `blurCard 24px`, `blurFloat 32px`, `blurSheet 36px`, `blurOverlay 20px`
- **Motion tokens:** `springGentle (180/22)`, `springCrisp (260/26)`, `springSilk (140/28)`, `easeOutQuint`, `easeInOutSine`
- **Duration tokens:** `dur-fast 90ms`, `dur-snap 180ms`, `dur-base 240ms`, `dur-page 320ms`, `dur-sheet 400ms`

### A2. Navigation
- **FloatingTabBar** — 4 tabs (Requests · Sessions · Machines · History), glass pill, animated active chip, badge slot per tab

### A3. Screens (9)
1. **QRScanScreen** (no permission · scanning · connecting · connected · error)
2. **RequestsListScreen** (header · segmented control · list · skeleton · empty per segment)
3. **RequestDetailScreen** (header card · bash block · files · diff · banner · sticky footer)
4. **SessionsScreen** (header · session cards · empty)
5. **SessionDetailScreen** (custom header · pending requests · sent prompts)
6. **FileBrowserScreen** (path bar · tree · hint bar · long-press menu · error)
7. **PromptComposeSheet** (handle · title · template chips · input · char counter · send/cancel)
8. **MachinesScreen** (header · machine cards · empty)
9. **HistoryScreen** (header · two-group filter chips · dense rows · empty)

### A4. Shared components (35)
RequestCard · RiskBadge · ToolBadge · StatusDot · SegmentedControl · FilterChip · FilterChipGroup · TemplateChip · SectionHeader · EmptyState · SkeletonCard · LiveIndicator · DecisionBanner · StickyDecisionFooter · BashCommandBlock · DiffViewer · DiffFileHeader · DiffLine · FileChip · FilePathRow · TreeRow · PromptRow · MachineCard · SessionCard · PrimaryInkButton · SecondaryGlassButton · DangerGlassButton · GhostButton · IconButton · TextInput · HeaderBar · CustomNavHeader · PathBar · HintBar · AlertSheet (native) · Spinner · Toast · ClayIcon

---

## PART B — Design System Rules

### B1. Concrete tokens (drop-in values)

```json
{
  "color": {
    "light": {
      "bgGradientTop":     "#C76B4A",
      "bgGradientBottom":  "#FBEFE4",
      "bgGrain":           "rgba(60, 30, 18, 0.025)",
      "cream":             "#FBF6EE",
      "creamDeep":         "#F2E7D7",
      "surface":           "#FFFBF5",
      "surfaceGlass":      "rgba(255, 247, 240, 0.55)",
      "surfaceGlassStrong":"rgba(255, 247, 240, 0.72)",
      "border":            "rgba(120, 60, 40, 0.10)",
      "borderGlass":       "rgba(255, 255, 255, 0.60)",
      "borderHairline":    "rgba(120, 60, 40, 0.06)",
      "textPrimary":       "#1F140E",
      "textSecondary":     "#5A4A3F",
      "textTertiary":      "#8C7A6E",
      "textInverse":       "#FBF6EE",
      "accentEmber":       "#E47A4E",
      "accentEmberDeep":   "#C0552B",
      "accentEmberLight":  "#FCDFCD",
      "inkBlack":          "#111111",
      "inkBlackHover":     "#222222",
      "danger":            "#C84038",
      "dangerLight":       "#F4CFCB",
      "warning":           "#D69A2C",
      "success":           "#7AA56F",
      "successDark":       "#3F6B3A",
      "info":              "#6A8FB3",
      "codeBg":            "#1B1614",
      "codeBgRaised":      "#241D1A",
      "codeText":          "#F0E6DA",
      "focusRing":         "#E47A4E"
    },
    "dark": {
      "bgGradientTop":     "#3A1A12",
      "bgGradientBottom":  "#1A0F0A",
      "bgGrain":           "rgba(255, 220, 200, 0.03)",
      "cream":             "#221814",
      "creamDeep":         "#2F221C",
      "surface":           "#2A1F1A",
      "surfaceGlass":      "rgba(60, 32, 22, 0.55)",
      "surfaceGlassStrong":"rgba(70, 38, 26, 0.72)",
      "border":            "rgba(255, 220, 200, 0.10)",
      "borderGlass":       "rgba(255, 220, 200, 0.16)",
      "borderHairline":    "rgba(255, 220, 200, 0.06)",
      "textPrimary":       "#F5EBE0",
      "textSecondary":     "#C9B6A6",
      "textTertiary":      "#8E7A6C",
      "textInverse":       "#1A0F0A",
      "accentEmber":       "#F08A5E",
      "accentEmberDeep":   "#FBA37A",
      "accentEmberLight":  "rgba(244, 138, 94, 0.18)",
      "inkBlack":          "#FBF6EE",
      "inkBlackHover":     "#FFFFFF",
      "danger":            "#E07067",
      "dangerLight":       "rgba(224, 112, 103, 0.18)",
      "warning":           "#E2B45A",
      "success":           "#9CC592",
      "successDark":       "#BDD9B5",
      "info":              "#8AA9CB",
      "codeBg":            "#0E0907",
      "codeBgRaised":      "#1A1311",
      "codeText":          "#F0E6DA",
      "focusRing":         "#F08A5E"
    }
  },
  "risk": {
    "low":      { "bg": "#E8EFE2", "text": "#3F6B3A", "border": "#C9DCC0", "dot": "#7AA56F", "whisper": "rgba(122,165,111,0.06)" },
    "medium":   { "bg": "#FBEBC9", "text": "#8A5A12", "border": "#EBD49A", "dot": "#D69A2C", "whisper": "rgba(214,154,44,0.06)" },
    "high":     { "bg": "#F8DCC8", "text": "#9A4322", "border": "#ECC2A4", "dot": "#D46A38", "whisper": "rgba(212,106,56,0.06)" },
    "critical": { "bg": "#F4CFCB", "text": "#8A2A26", "border": "#E5ADA7", "dot": "#C84038", "whisper": "rgba(200,64,56,0.07)" }
  },
  "tool": {
    "Bash":      { "bg": "#1B1614", "text": "#F0E6DA", "dot": "#E47A4E", "clayIconId": "terminal-cube" },
    "Write":     { "bg": "#FBEBC9", "text": "#8A5A12", "dot": "#D69A2C", "clayIconId": "folded-paper" },
    "Edit":      { "bg": "#E8EFE2", "text": "#3F6B3A", "dot": "#7AA56F", "clayIconId": "pencil-on-paper" },
    "MultiEdit": { "bg": "#E0E6F0", "text": "#34507A", "dot": "#6A8FB3", "clayIconId": "stacked-papers" },
    "unknown":   { "bg": "#EFE7DC", "text": "#5A4A3F", "dot": "#8C7A6E", "clayIconId": "question-pebble" }
  },
  "type": {
    "displayXL":  { "family": "Fraunces",       "size": 36, "weight": 500, "lh": 1.04, "track": "-0.022em" },
    "displayL":   { "family": "Fraunces",       "size": 30, "weight": 500, "lh": 1.05, "track": "-0.02em"  },
    "displayM":   { "family": "Fraunces",       "size": 24, "weight": 500, "lh": 1.08, "track": "-0.015em"},
    "cardTitle":  { "family": "Fraunces",       "size": 17, "weight": 500, "lh": 1.30, "track": "-0.01em" },
    "body":       { "family": "Inter",          "size": 15, "weight": 400, "lh": 1.45, "track": "0" },
    "bodyEmph":   { "family": "Inter",          "size": 15, "weight": 500, "lh": 1.45, "track": "0" },
    "label":      { "family": "Inter",          "size": 13, "weight": 500, "lh": 1.30, "track": "0" },
    "labelStrong":{ "family": "Inter",          "size": 13, "weight": 600, "lh": 1.30, "track": "0.005em" },
    "metadata":   { "family": "Inter",          "size": 12, "weight": 450, "lh": 1.30, "track": "0.005em" },
    "mono":       { "family": "JetBrains Mono", "size": 13, "weight": 450, "lh": 1.55, "track": "0" },
    "monoSmall":  { "family": "JetBrains Mono", "size": 12, "weight": 450, "lh": 1.50, "track": "0" },
    "microLabel": { "family": "Inter",          "size": 11, "weight": 600, "lh": 1.20, "track": "0.06em",  "case": "uppercase" }
  },
  "radius":  { "xs": 8, "sm": 12, "md": 16, "lg": 22, "xl": 28, "2xl": 36, "full": 999 },
  "spacing": [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 56],
  "elevation": {
    "glassLow":  { "blur": 24, "saturate": 1.40, "shadow": "0 8px 24px rgba(120,60,40,0.08)",  "innerHL": "inset 0 1px 0 rgba(255,255,255,0.6)" },
    "glassHigh": { "blur": 32, "saturate": 1.50, "shadow": "0 16px 40px rgba(120,60,40,0.18)", "innerHL": "inset 0 1px 0 rgba(255,255,255,0.7)" },
    "inkPill":   { "shadow": "0 8px 20px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.04) inset" },
    "nestedDark":{ "shadow": "inset 0 1px 0 rgba(255,255,255,0.04)" }
  }
}
```

### B2. The three z-layers (depth is information)

| Layer | Purpose | Treatment |
|---|---|---|
| **L0 — Sky** | Screen background | Vertical gradient `bgGradientTop` → `bgGradientBottom`, 0% at top to 100% at ~70% of screen height, then holds cream. Overlaid with `bgGrain` SVG noise at 2% opacity. *Every* screen sits on this — no flat white. |
| **L1 — Glass** | Cards, inputs, list rows | `surfaceGlass` fill, `blurCard` backdrop blur, `borderGlass` inner highlight (1px inset top), `borderHairline` outer (1px), `glassLow` shadow. Radius `lg` or `xl`. |
| **L2 — Float** | Tab bar, sheets, popovers, sticky footer | `surfaceGlassStrong` fill, `blurFloat` blur, `glassHigh` shadow. Sheets get `2xl` top corners only. |
| **Ink** | Primary CTAs | `inkBlack` fill, `textInverse` label, `full` radius, height 56, `inkPill` shadow. **One per screen.** |

### B3. Typography rules
- **Every screen title** is `displayL` (or `displayXL` on QR/Empty/Onboarding), set in Fraunces, broken to **exactly two lines** by an explicit `\n`. Examples: *"Pending\nRequests"*, *"All clear,\nno requests."*, *"Send a\nprompt."*
- **Subtitles** are `body` in `textSecondary`, max one line.
- **Section headers** are `microLabel` (uppercase, 11/600, tracked) — never larger.
- **Mono content** never uses italic. Serif italic is reserved for: `LiveIndicator`, `ToolBadge` name, `HintBar` copy, decision banner labels.
- **Tabular numerals** on: badge counts, char counters, byte sizes, diff counts, time meta.
- **Line breaks** in serif titles: prefer breaking after a function word (a, the, to, your) so the second line carries the noun.

### B4. Risk visual hierarchy
Risk must be readable in **three independent channels** so the design works at a glance, under poor contrast, and for color-blind users:
1. **Color** — botanical risk palette
2. **Label** — the word "Low" / "Medium" / "High" / "Critical"
3. **Icon** — duotone leading glyph (checkmark · alert-outline · alert · close)

The card itself also receives a `whisper` tint at the top-12% gradient fade — never enough to compete with content, but enough to subliminally signal severity.

### B5. The Ink Pill discipline
- One per screen, period.
- It is always **the decision** (Approve, Send, Continue, Connect, Grant access).
- Width: full content width minus card padding. Height: 56. Radius: `full`.
- Label: sans 16/600, sentence case, no icon unless the action genuinely benefits from one (Send → paper plane; QR success → checkmark).
- When a screen has *no* decision (e.g. History, Machines), there is **no ink pill at all** — that's correct and intentional.

### B6. Glass-over-gradient contrast safety
- All text on glass cards must clear **4.5:1** against the *worst-case* gradient pixel underneath (test against `bgGradientTop`).
- If text would fail: bump glass fill to `surfaceGlassStrong` for that card, not the global token.
- `reduce-transparency` setting must collapse all glass to solid `cream` (`#FBF6EE`) with `border` outline — design every component for both modes.
- `prefers-reduced-motion`: disable status-dot pulse, breathing brackets, card scale-in. Keep page fades but shorten to `dur-snap`.

---

## PART C — Worked Example (calibration target)

> **Generate the *Requests List Screen* exactly as specified below before doing any other screen. This is your style calibration. Use the same level of rigor — geometry, states, motion, accessibility — for every subsequent component.**

### Screen: RequestsListScreen — Pending segment, 3 items, with 1 active swipe

**Canvas:** 390×844 (iPhone 15 reference).

**Layout grid (top to bottom):**

| Y (px) | Element | Spec |
|---|---|---|
| 0–59 | Status bar | system, content-aware tint |
| 56–144 | HeaderBar | left-aligned, padded 20 horizontal |
| 56–104 | Display title | *"Pending\nRequests"* — `displayL`, two lines, `textPrimary`. Line break after "Pending". |
| 110–130 | Subtitle | *"3 awaiting your call."* — `body`, `textSecondary` |
| 110–134 | LiveIndicator | top-right, glass pill, `↻ live` |
| 156–204 | SegmentedControl | 3 segments: *Pending (3) · Approved (12) · Denied (4)*. L1 glass, full radius, 48 tall, side margin 20. |
| 220–end | RequestCard list | gap 12 between cards, side margin 20, bottom padding for tab bar (104) |
| 760–824 | FloatingTabBar | L2 glass, 60 tall, side margin 20, bottom inset 20 |

**RequestCard #1 — *Bash · High risk · being swiped right***

- Container: L1 glass, radius `xl`, padding 20, width = screen − 40.
- The card is translated +112px on the X axis; behind it, a sage panel is revealed full-bleed: leading checkmark icon (24, `successDark`) + label *"Approve"* in `displayM` italic, vertically centered, 24px from leading edge.
- **Card content (no left strip — banned):**
  - Top row (`display:flex, justify:between, align:center`):
    - Left: `[7px Bash dot · "Bash" in Fraunces italic 13/500]`
    - Right: `[RiskBadge: high — pill 24h, padding 10/3, bg rust, text rust-ink, leading 12px alert icon]`
  - Title (mt 12): *"Run database migration on production"* — `cardTitle`, 2 lines max, `textPrimary`.
  - File chips row (mt 12): none for Bash.
  - Meta row (mt 16, separated from title by a 1px `borderHairline` divider at mt 12 with mb 12):
    - Left: `[machine dot 5px green] [machine "prod-runner-01"] [textTertiary "·"] [time "2m ago"]`
    - All `metadata`, color `textSecondary` for machine name, `textTertiary` for the rest.
  - Whisper: `risk.high.whisper` linear-gradient from top of card fading to transparent at 40% height.

**RequestCard #2 — *Edit · Low risk · idle***

- Same container.
- Top row: `[Edit dot sage · "Edit" italic]` … `[RiskBadge low — sage]`
- Title: *"Add null check to user-session helper"*
- File chips (mt 12): two pills — `auth/session.ts` and `auth/helpers.ts`, each glass pill 24h with `monoSmall` filename only (path stripped), 12px file icon leading. Overflow: *"+1 more"* in `metadata`.
- Meta: `[mac-mini-studio · 14m ago]`

**RequestCard #3 — *Write · Medium · idle, CLI-pending***

- Top row: `[Write dot honey · "Write" italic] [CLI micro-pill in glass, 11/600 uppercase tracked, height 18, padding 6/2]` … `[RiskBadge medium]`
- Title: *"Create new file scripts/cleanup.sh"*
- File chips: `cleanup.sh`
- Meta: `[devbox-2 · 22m ago]`

**SegmentedControl detail:**
- L1 glass pill, full radius, 4px inner padding.
- Active *"Pending (3)"* segment: cream fill `creamDeep`, inset shadow `nestedDark`, label `labelStrong textPrimary`, count `(3)` in `metadata textTertiary`.
- Inactive segments: transparent, label at 55% `textPrimary`.
- Tapping: spring `springCrisp` on the moving pill, 180ms duration.

**LiveIndicator detail:**
- Glass micro-pill, 22 tall, padding 8/4.
- 6px ember dot (no pulse — it represents "the poll is alive", static is fine) + `microLabel` *"LIVE"* in `textSecondary`. Use serif italic *live* if you prefer the warmer feel; both acceptable.

**FloatingTabBar detail:**
- 60 tall, side margin 20, bottom inset 20, radius `full`, L2 glass.
- 4 tabs equal-width when inactive. Active tab expands into a pill chip containing icon + serif-italic label *"Requests"*, fill `accentEmberLight`, label `accentEmberDeep`.
- Badge on Requests icon: 16px circle, `accentEmber` fill, white tabular *3*, sits at top-right of the icon with a 2px cream cutout from the bar surface so it reads even when overlapping the icon.
- Inactive icons at 50% `textPrimary`.

**Empty state for this segment** (when count = 0):
- ClayIcon hero (88px) of a small bell with a sage sprig, centered, 80px from top of content area.
- Title: *"All clear,\nno requests."* `displayM`, centered.
- Subtitle: *"You'll see new requests here the moment Claude needs you."* `body`, `textSecondary`, centered, max-width 280.
- No CTA.

**Loading skeleton:**
- 3 skeleton cards matching real geometry.
- Inside each: 3 horizontal blocks (top-row, title-2-lines, meta-row) filled at `creamDeep`, opacity pulsing 0.6 → 1.0 at 1.2s, ease-in-out, infinite. No directional shimmer.

**States to deliver:** default · pulled-to-refresh (rubber-band with `springGentle`, spinner glass pill at top) · loading (skeletons) · empty (per segment) · error (glass card with ember "Retry" ghost button) · all 3 segments populated.

**Motion to deliver:**
- Page enter: title `slide-y +12 → 0, opacity 0 → 1`, 320ms `easeOutQuint`. Subtitle staggered +60ms. Segmented control +120ms. Cards staggered 40ms each.
- Card swipe: follows finger with `springGentle`; threshold 96px before action commits; haptic on threshold cross; release before threshold snaps back with `springCrisp`.
- Tab change: cross-fade list 180ms; segmented pill morph 180ms.

**A11y to deliver:**
- Hit target on RequestCard ≥ 72 tall.
- Swipe actions exposed as Accessibility Actions ("Approve", "Deny").
- VoiceOver order per card: tool → risk → summary → machine → time.
- Reduce-transparency: glass → solid `cream` with `border` outline; segmented control active = `surface` with `border`.
- Reduce-motion: no swipe-rubber-band overshoot, dot pulses off, page fade 120ms.

---

## PART D — Per-screen recipes (concise)

Each recipe is in the form: **purpose · header · body composition · primary action · empty state · special states**.

### D1. QRScanScreen
- Purpose: pair this device with a desktop machine.
- Header: none (camera is the canvas).
- Body: top dark-to-transparent gradient overlay (0–180px) holding 56×56 glass ClayIcon hammer tile + `displayM` *"Vibe\nRemote."* + `body` subtitle. Center 240×240 scan area with 4 corner brackets (3px, 28px legs, radius sm). Bottom dark-to-transparent gradient overlay (last 200px) holding a L2 glass status pill.
- Primary action: **noPermission** state shows an Ink Pill *"Grant camera access"*. All other states show no pill — the camera *is* the interaction.
- Empty state: n/a.
- Special states: `connecting` (spinner inside scan frame, status pill *"Connecting…"* serif italic), `connected` (brackets snap sage, hairline glass frame fills, pill *"Connected!"*, soft success haptic, auto-dismiss 800ms), `error` (system AlertSheet with *Try again*).

### D2. RequestsListScreen
*(See Part C — calibration target.)*

### D3. RequestDetailScreen
- Purpose: full context for one request; approve or deny.
- Header: compact nav (back chevron + tool name `cardTitle` + share IconButton). On scroll: a large `displayL` *"Run database\nmigration."* parallaxes up and tucks into the nav.
- Body composition (top → bottom):
  1. **Header card** (L1 glass, radius `xl`): tool name `displayM`, RiskBadge top-right, summary `body` 2–3 lines, 3-column info row (Machine · Risk reason · Time), each column is a `microLabel` over a `labelStrong` value.
  2. **BashCommandBlock** (only Bash tool): nested dark card `codeBg`, radius `md`, padding 16, mono 13, `$` in `accentEmber`, horizontal scroll with cream right-edge fade gradient 24px wide.
  3. **Files section** (Edit/Write/MultiEdit): `microLabel` *"FILES · 3"* + glass card list of `FilePathRow`s (16px file icon + mono path full).
  4. **DiffViewer** (when diffs present): see component spec.
  5. Spacer 96px for sticky footer.
- Primary action: sticky L2 glass footer at bottom containing `[DangerGlassButton "Deny"]` + `[PrimaryInkButton "Approve"]`. Approve is ~64% width, ink pill, 56 tall; Deny is glass pill, 48 tall, madder hairline + madder text.
- When already decided: footer is replaced by a `DecisionBanner` (sage *"Approved 14m ago by you"* or madder equivalent).
- Special: offline machine → header card shows a small honey "Offline" pill; approve button shows tooltip *"Will queue until back online"* but remains active.

### D4. SessionsScreen
- Purpose: see all live Claude sessions.
- Header: *"Active\nsessions."* + subtitle *"2 running · 1 idle."* + LiveIndicator top-right.
- Body: vertical list of SessionCards (gap 12).
- Primary action: none (per-card actions only — no screen-level ink pill).
- Empty: ClayIcon lightning (88px), title *"No sessions\nrunning."*, subtitle with inline `<code>scripts/hook.js</code>` in dark code chip.

### D5. SessionDetailScreen
- Purpose: drill into one session's pending requests + sent prompts.
- Header: **custom nav** replaces system nav. Two-line stack: mono cwd `~/projects/vibe-remote` (truncated middle), `metadata` machine name. Right side: `[SecondaryGlassButton "Files"]` + `[SecondaryGlassButton "Prompt" with ember tint]`. When offline: Files disabled, label *"Offline"*.
- Body: two SectionList sections:
  1. *"PENDING REQUESTS · 2"* — RequestCards (swipeable).
  2. *"SENT PROMPTS · 5"* — PromptRows (status icon + 2-line prompt + meta + optional Cancel ghost button).
- Primary action: none at screen level.
- Empty per section: small inline empty cards with `cardTitle` *"No pending requests."* / *"No prompts sent yet."*.

### D6. FileBrowserScreen
- Purpose: browse a remote machine's file tree.
- Header: PathBar — slim L2 glass strip pinned at top under the nav, mono path, trailing 16px spinner when loading.
- Body: tree of TreeRows on the gradient (no card chrome), 44 tall, depth indent 16. Chevron rotates 90° on expand (180ms `easeOutQuint`). Files show right-aligned `monoSmall` size. Unloaded dirs show *"tap to load"* in `metadata textTertiary`.
- Long-press: native AlertSheet with the path + *Use in prompt* action.
- Hint bar: L2 glass strip at bottom, `body` serif italic *"Long-press to use a path in your prompt."*
- Error: glass card with ember ghost *"Retry"*.

### D7. PromptComposeSheet
- Presentation: bottom sheet, L2 glass, radius `2xl` top corners only, height ~64% of screen (grows with input up to ~78%).
- Handle: 36×4 in `creamDeep` at top center, mt 8.
- Title: *"Send a\nprompt."* `displayM`.
- Subtitle: *"Delivered when Claude is idle with no pending approvals."* `body textSecondary`.
- Template chips: horizontal scroll with −20 bleed, 4 chips (*Refactor · Add tests · Fix bug · Explain*). Each: glass pill, 36 tall, serif italic label.
- Input: L1 glass card, radius `lg`, padding 16, mono 14, min 120, max 260, auto-focus.
- Footer row: `[char count "0 / 2000" mono tabular textTertiary]` left, `[SecondaryGlassButton "Cancel"]` + `[PrimaryInkButton "Send" with 16px paper-plane icon]` right.
- Primary action: Send (the ink pill).
- Disabled: Send at 30% opacity when input empty or > 2000 chars.

### D8. MachinesScreen
- Purpose: see registered machines and their status.
- Header: *"Connected\nmachines."* + subtitle *"3 online · 1 offline."* + top-right `[GhostButton "Disconnect" with madder text + 1px madder hairline]`.
- Body: vertical list of MachineCards.
- Primary action: none (Disconnect is destructive secondary; lives in header).
- Empty: ClayIcon server pebble + title *"No machines\nregistered yet."* + subtitle with `<code>node scripts/setup.js</code>` chip.

### D9. HistoryScreen
- Purpose: log of past decisions.
- Header: *"Decision\nhistory."* + subtitle *"248 decisions."*
- Below header: FilterChipGroup, horizontal scroll, two groups separated by a 1px `border` vertical hairline (NOT an accent border). Group 1: All · Approved (124) · Denied (124). Group 2: Bash (88) · File Edit (160).
- Body: dense rows directly on the gradient (no per-row card), 1px `borderHairline` dividers. Each row: `[36×36 botanical icon tile, radius md]` + 2-line layout (tool name + status right · summary + machine·time below).
- Primary action: none.
- Empty (filtered): title *"No matches\nin history."* + subtitle *"Try a different filter."*

---

## PART E — Output template (use for every item)

```
### [Component Name]

**Purpose** (1 line)
**Used in** (which screens / parents)

**Anatomy**
- Element 1: …
- Element 2: …

**Layout**
- Width / height behavior
- Internal grid: padding, gaps, alignment

**Tokens**
- Surface: L0 / L1 / L2 / Ink + which token
- Color: bg, text, border, dot (cite tokens, not hex)
- Type: which role, weight, family

**Geometry**
- Radius: …
- Border: …
- Shadow / blur: …

**States**
| State        | Visual                                  | Notes |
|--------------|-----------------------------------------|-------|
| default      | …                                       | …     |
| pressed      | scale 0.97, dur-fast                    | …     |
| focused      | 2px ember focusRing, 2px offset         | …     |
| disabled     | 30% opacity, no shadow                  | …     |
| loading      | opacity pulse 0.6→1.0, dur 1.2s         | …     |
| empty        | …                                       | …     |
| error        | …                                       | …     |

**Motion**
- Trigger → property → curve → duration

**Accessibility**
- Min hit target: 44×44
- Text contrast: ≥ 4.5:1 (tested against worst-case gradient pixel)
- Non-text contrast: ≥ 3:1
- VoiceOver label & order
- reduce-transparency fallback: solid cream + border
- reduce-motion fallback: …
- Dynamic Type: behavior at 120% / 200%

**Anti-patterns** (do NOT do)
- … (with the correct alternative)

**Notes** (hierarchy & rationale, 1–2 sentences)
```

---

## PART F — Rejections & North-Star

### F1. Explicit rejections — never generate

| ❌ Anti-pattern | ✅ Correct alternative |
|---|---|
| Left vertical color strip on cards | Status dot, tinted icon tile, or top-right RiskBadge |
| Pure white `#FFFFFF` surface | `cream` or glass |
| Cool grey dashboard chrome | Warm neutrals only (everything biases toward `textPrimary`/`textSecondary`) |
| Cold iOS system blue/red/green | Botanical risk palette + ember accent |
| Sharp 0–4px corner radius on cards | `lg` (22) or `xl` (28) |
| 2px borders | 1px hairline `border` + 1px inner highlight `borderGlass` |
| `shadow-lg`, `shadow-2xl` Tailwind defaults | Warm-tinted custom shadows `rgba(120,60,40,…)` |
| Outer glow / neon shadows | Soft warm drop shadow only |
| Two or more solid black/ink CTAs on one screen | Exactly one ink pill — *the decision* |
| Always-labeled bottom tabs | Only active tab shows label |
| Emoji as functional icons | Phosphor Duotone or ClayIcon |
| All-caps section headers > 11px | `microLabel` 11/600 tracked |
| Linear shimmer skeletons | Opacity pulse 0.6 → 1.0 |
| Random italic on body or mono | Italic reserved for serif: LiveIndicator, ToolBadge name, HintBar, DecisionBanner label |
| Title in one long line | Two lines, deliberately broken |
| Risk shown by color alone | Always color + label + icon |
| Glass piled on glass piled on glass (vision-blur chaos) | Max two glass layers visible at once (L1 + L2) |
| Centered nav titles competing with serif display | Compact nav stays sans 13/500; display lives in the body |

### F2. The North-Star check (run for every screen)

1. **Glance test:** can a developer approve in *one glance + one tap*?
2. **Triple-channel risk:** is risk visible via color **and** label **and** icon?
3. **Ink discipline:** is there *exactly one* ink pill, and is it *the decision*?
4. **Serif carries the screen:** does the display title own the page, two lines, line-broken with intent?
5. **Glass contrast survives reduce-transparency:** swap glass for solid cream — does it still pass 4.5:1?
6. **Strip the gradient test:** remove the sky; does the layout still hold its hierarchy?
7. **Magazine, not dashboard:** would this feel at home in a printed editorial spread?
8. **Touchability:** every interactive element ≥ 44×44, ink pills ≥ 56?
9. **Mono first-class:** code, paths, diffs use JetBrains Mono with line-height ≥ 1.5 and proper warm syntax — never collapsed into UI text?
10. **One hero per screen:** at most one ClayIcon. If two appear, kill one.

### F3. Calibration mantra
> *"A printed magazine you can tap. Warmth is the brand; precision is the product."*

---

## PART G — Asset & engineering notes

- **Fonts:** Fraunces (Google Fonts, variable, opsz + wght axes). Inter (variable). JetBrains Mono.
- **Icons (system):** Phosphor Duotone @ 1.5px stroke OR SF Symbols (use `palette` rendering with ember accent).
- **ClayIcon assets:** PNG @3x with transparent background, 256×256 source, baked warm key light (top-left, 35°), soft AO, no specular blowouts. Library: `terminal-cube`, `folded-paper`, `pencil-on-paper`, `stacked-papers`, `question-pebble`, `hammer`, `server-pebble`, `bell-with-sprig`, `lightning`, `clock`, `key`, `paper-plane`.
- **Gradient implementation:** prefer `LinearGradient` view with 2 stops; overlay an SVG noise pattern at 2% opacity for grain. On Android, fall back to a baked PNG to avoid banding.
- **Backdrop blur:** iOS `UIVisualEffectView` (`.systemUltraThinMaterial`) tinted with `surfaceGlass`. Android: `RenderEffect.createBlurEffect`. Web: `backdrop-filter`. Always include the solid-cream fallback.
- **Haptics:** soft impact on ink pill press; success on Approve / Connected; warning on Deny; selection on tab/segment change.
- **Safe areas:** respect top inset for header padding; bottom inset adds to tab bar offset (20 + inset).
