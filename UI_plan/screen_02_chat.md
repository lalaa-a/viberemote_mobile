# Screen 02 — Chat / Conversation (ChatScreen)
> Part of the vibeRemote dark-navy UI redesign. Plan only — implement after review.

The Chat screen is the busiest surface in the app: a WhatsApp-style feed mixing agent
reasoning, tool activity, approval cards, questions, and user prompts, plus a compose bar
with several locked states. This plan maps **every** sub-component onto the new dark theme
and reuses the shadcn-style primitives (`BackButton`, `Button`, `Badge`, `Card`) we built
for the Details screen.

---

## 0. Scope — files touched

| File | Change |
|---|---|
| `src/screens/Sessions/ChatScreen.tsx` | Full dark restyle: header (details-style), status strip, all 7 feed bubbles, compose bar + states |
| `src/components/QuestionCard.tsx` | Full dark restyle (used in the feed) |
| `src/components/RiskBadge.tsx` | **Retire** from chat — replace usages with the canonical `Badge` + `RISK_VARIANT`. (Leave file or dark-restyle; see §7) |
| `src/components/ui/Button.tsx` | Add a `sm` size + optional `icon` (Deny/Approve inside cards are shorter than the footer buttons) |
| `src/constants/colors.ts` | Add a small **dark tool tint** map + a couple of semantic tint helpers (§10) |

`HarnessBadge` stays as-is for now (it already has a neutral fallback; a dark pass is a later polish).

---

## 1. Token mapping (light `Colors` → new `DarkColors`)

Every reference below uses these swaps:

| Role | Old (`Colors`) | New (`DarkColors`) |
|---|---|---|
| Screen background | `pageBg` / cream | `bg` `#082134` |
| Card / bubble surface | `bgPrimary`, `surfaceGlassStrong` | `surface` `#143753` |
| Raised (strip, input, avatar, sent bubble) | `accentLight`, `creamDeep` | `surfaceRaised` `#164269` |
| Divider / border | `borderHairline` | `border` `rgba(255,255,255,0.06)` |
| Input / stronger border | `borderGlass` | `borderMid` `rgba(255,255,255,0.10)` |
| Primary text | `textPrimary` | `textPrimary` `#FFFFFF` |
| Secondary text | `textSecondary` | `textSecondary` `rgba(255,255,255,0.65)` |
| Muted / time | `textTertiary` | `textTertiary` `rgba(255,255,255,0.40)` |
| Success / active / "go" | `success`, `successDark` | `online` `#27E07E` |
| Warning / pending | `warning` | `unpair` `#D9A441` (amber) |
| Danger / deny | `danger` | `danger` `#EF5350` |
| Code block bg | `codeBg` dark | `bg` `#082134` |
| Accent action (send, jump) | `accentDeep` | `badgeBg` `#1976D2` (blue) |
| Body font | `sans` (Inter) | `googleSans` |
| Code font | `mono` | `mono` (unchanged) |

---

## 2. Header / top bar — **refer Details screen**

Reuse the Details pattern: circular `BackButton` + a pill. No cream glass, no bottom hairline over cream.

```
[ ‹ ]  [  dirLabel   ⟨harness⟩  ]  [ 🗀 ]
```

| Element | Spec |
|---|---|
| Container | `paddingTop: insets.top + 12`, `paddingHorizontal: 20`, `paddingBottom: 8`, `flexDirection: row`, `alignItems: center`, `gap: 10`, background `DarkColors.bg` |
| Back | `<BackButton />` (shared circular, `surfaceRaised`) — replaces the old inline chevron |
| Title pill | `flex: 1`, `height: 40`, `surfaceRaised`, `Radius.full`, `paddingHorizontal: 16`; contains `dirLabel` (`textPrimary`, 600, `googleSans`, `numberOfLines: 1`) + `HarnessBadge size="xs"` |
| Folder button | Circular 40×40 `surfaceRaised` (same shape as BackButton) with `folder-outline` `textSecondary`; `opacity 0.4` + disabled when `!machineIsOnline` |
| Refetch spinner | Small `ActivityIndicator color={DarkColors.textSecondary}` — tuck it left of the folder button |

> The old header showed `machineLabel · cwd` as a sub-line. Move that into the status strip (§3) so the top row stays clean like Details.

---

## 3. Status strip

Full-width thin strip under the header.

| Element | Spec |
|---|---|
| Container | `paddingHorizontal: 20`, `paddingVertical: 6`, `flexDirection: row`, `alignItems: center`, `gap: 6`, background `DarkColors.surface`, bottom border `DarkColors.border` |
| Status dot + label | `active → online`, `idle → unpair (amber)`, `finished/closed → textTertiary`. Dot 6×6, label 12 `googleSans` 500 |
| Machine label | append `machineLabel` in `textTertiary` after a `·` separator |
| Offline chip | when `!liveOnline`: pill `rgba(239,83,80,0.15)` bg, `danger` text, "machine offline" |

---

## 4. Feed bubbles

### 4.1 OutputBubble (agent reasoning) — **plain CLI output, NOT a bubble** — §13
Agent reply/reasoning from the harness is **not** wrapped in a speech bubble. It lays out
plainly across the full chat width like real CLI output (only the user's own prompts stay as
right-aligned bubbles — §4.2).
- Full-width block, `paddingHorizontal: 4`, thin left rule `rgba(39,224,126,0.35)` to organize
  consecutive reasoning; no surface/border/avatar.
- Header line: small `sparkles-outline` (`online`) + relative time (`textTertiary`).
- Body: `FontFamily.mono`, `textPrimary`, rendered via `useTypewriter` — a *newly arrived* row
  prints character-by-character with a blinking cursor; history/recycled rows render instantly.
  Rationale in **§13**.
- "Show more/less": `online` green.

### 4.2 SentBubble (user prompt — right)
- Bubble: `surfaceRaised` bg, `Radius.md` with `borderTopRightRadius: 4`.
- Text: `textPrimary`.
- Meta time: `rgba(255,255,255,0.5)`; status tick: delivered → `online`, pending/failed → `textTertiary`.

> Received = `surface`, Sent = `surfaceRaised` — one step apart + opposite alignment + opposite corner-cut keeps them distinct without introducing an off-palette color.

### 4.3 NotifyRow (centered)
- Italic `textTertiary`, centered. Recolor only.

### 4.4 StopRow ("Task complete" divider)
- Lines: `DarkColors.border`.
- Pill: `surfaceRaised` bg, `checkmark-done-circle` + text + time in `online` green.

### 4.5 ActivityBubble (tool_start / tool_end — compact)
- Icon box: 22×22 `Radius.xs`, bg from **dark tool tint** (§10), icon `textPrimary`.
- Text: tool name `textPrimary` 600 + summary `textSecondary`, `mono`.
- Badge: `running` → amber tint (`rgba(217,164,65,0.18)` bg / `unpair` text); `done` → green tint (`rgba(39,224,126,0.18)` bg / `online` text).

### 4.6 ThinkingBubble (animated dots) — plain inline (no bubble)
- Plain inline row (no avatar/surface). Dots + label: `online` when thinking, `unpair` (amber)
  when "Waiting for approval…".

### 4.7 RequestCard (tool approval) — **use the new primitives**
Rebuild with `Card` + `Badge` + `Button`:

| Part | Spec |
|---|---|
| Card | `Card` (surface), plus a **left risk border** `borderLeftWidth: 3`, `borderLeftColor` = risk color (`online`/`unpair`/`danger`/`dangerDeep`) |
| Header row | tool icon box (`surfaceRaised`, icon `textPrimary`) + tool name (`textPrimary` 600) + risk `Badge variant={RISK_VARIANT[risk_level]}` |
| Decided badge | `Badge variant="success"` ("Approved") or `variant="danger"` ("Denied") when `status !== 'pending'` |
| Summary | `textSecondary`, `mono`, numberOfLines 6/3 |
| Command block | bg `DarkColors.bg`, `mono` text `textPrimary`, `$`-less (or keep), numberOfLines 4 |
| Inspect hint | "View full diff / details" — `textTertiary` + chevron |
| Actions (pending) | `<Button variant="destructive" size="sm">Deny</Button>` + `<Button variant="success" size="sm">Approve</Button>` (needs the `sm` size — §0) |
| Time | `textTertiary` |

### 4.8 QuestionCard (feed) — see §6.

---

## 5. Compose bar

Container: `surface` bg, top border `DarkColors.border`, `paddingBottom: TAB_BOTTOM_INSET` (sits above the floating tab bar).

**Normal input row**
- Input: `surfaceRaised` bg, `borderMid` border, `Radius.xl`, text `textPrimary` `googleSans`, placeholder `textTertiary`, `minHeight 44 / maxHeight 120`.
- Send button: circular 44 `badgeBg` blue (enabled) → white `arrow-up`; disabled → `surfaceRaised` bg + `textTertiary` arrow.

**Locked states** (recolor the existing three notes):
| State | Spec |
|---|---|
| CLI closed | bg `rgba(239,83,80,0.12)`, `lock-closed` + title in `danger`, sub `textSecondary` |
| Harness off | bg `rgba(217,164,65,0.12)`, `power` + title in `unpair` (amber), sub `textSecondary` |
| Pending approvals | `hourglass-outline` + text in `unpair` (amber), centered |

---

## 6. QuestionCard — dark restyle

Keep all logic; swap styles:

| Element | New |
|---|---|
| Card | `surface`, `border`, `Radius.lg` (align with `Card`) |
| Kind label / time | `textSecondary` / `textTertiary` |
| Tabs | inactive: `surfaceRaised` + `border`; active: `online` border + `rgba(39,224,126,0.12)` bg, text `textPrimary` |
| Question | `textPrimary`, `googleSans` |
| Option | `surfaceRaised` bg + `border`; **selected**: `online` border + `rgba(39,224,126,0.12)` bg |
| Marks (◉/☑) | `textTertiary` → `online` when on |
| Preview block | bg `DarkColors.bg`, `mono` text `textSecondary` |
| "Other" input | `surfaceRaised` bg, `borderMid`, `textPrimary` |
| Submit | `<Button variant="success">` (or `primary`) |
| Answered state | check icon + chosen text in `online` |

---

## 7. RiskBadge disposition

We now have the canonical `Badge` + `RISK_VARIANT` (from the Details screen). Two options:

- **Recommended:** replace `RiskBadge` usages in Chat with `Badge variant={RISK_VARIANT[level]}` (text-only, matches Details). Delete `RiskBadge.tsx` if nothing else imports it.
- Alternative: dark-restyle `RiskBadge` to keep the icon+label form.

Plan proceeds with the recommended replacement; grep for other `RiskBadge` importers before deleting.

---

## 8. Misc surfaces
- **Empty state**: `chatbubbles-outline` `textSecondary`, title `textPrimary` `googleSans`, sub `textSecondary`.
- **Loading**: `ActivityIndicator color={DarkColors.online}`, text `textTertiary`.
- **Jump-to-latest pill**: `badgeBg` blue bg, white arrow + "Latest".
- **GradientBackground**: pass `style={{ backgroundColor: DarkColors.bg }}` (same override used on the other dark screens).
- **StatusBar**: `barStyle="light-content"`.

---

## 9. Button primitive extension (needed by RequestCard)

`Button` currently is one size (h52). Add:
- `size?: 'md' | 'sm'` → `sm` = height 44, `FontSize.label`.
- optional leading `icon?: string` (Ionicons name) so Deny/Approve can show ✕ / ✓ like today.

This keeps the footer (Details) and the in-card actions (Chat) on one component.

---

## 10. New tokens in `colors.ts`

```typescript
// Dark tool tints — icon-box backgrounds for ActivityBubble / RequestCard
export const DarkToolTint: Record<string, { bg: string; fg: string }> = {
  Bash:      { bg: 'rgba(255,255,255,0.08)', fg: '#FFFFFF' },
  Write:     { bg: 'rgba(217,164,65,0.18)',  fg: '#D9A441' },
  Edit:      { bg: 'rgba(39,224,126,0.18)',  fg: '#27E07E' },
  MultiEdit: { bg: 'rgba(25,118,210,0.18)',  fg: '#1976D2' },
  Read:      { bg: 'rgba(139,108,196,0.20)', fg: '#B79CE6' },
  unknown:   { bg: 'rgba(255,255,255,0.06)', fg: 'rgba(255,255,255,0.65)' },
}

// Semantic tints (badges / notes) — reuse inline where a translucent wash is needed
// online  → rgba(39,224,126,0.15)
// amber   → rgba(217,164,65,0.15)
// danger  → rgba(239,83,80,0.15)
```

Risk → color for the card's left border and Badge:
`low → online`, `medium → unpair`, `high → danger`, `critical → dangerDeep`.

---

## 11. Implementation order
1. `colors.ts` — add `DarkToolTint` (+ note the tint values).
2. `Button.tsx` — add `sm` size + optional `icon`.
3. `ChatScreen.tsx` — header (BackButton + pill + folder), status strip, StatusBar/bg.
4. `ChatScreen.tsx` — feed bubbles (Output, Sent, Notify, Stop, Activity, Thinking).
5. `ChatScreen.tsx` — `RequestCard` via `Card`/`Badge`/`Button`; replace `RiskBadge`.
6. `ChatScreen.tsx` — compose bar + 3 locked states + jump-to-latest + empty/loading.
7. `QuestionCard.tsx` — dark restyle.
8. Grep `RiskBadge` importers → replace/retire.

---

## 12. Follow-ups (out of scope here)
- `DiffViewer` dark pass (still light; shows inside Details cards).
- `HarnessBadge` dark polish.
- `FileBrowserScreen` dark pass (linked from the header folder button).
- Swap tool/harness Ionicons for the incoming SVGs.

---

## 13. CLI-style sequential output — research & decision

**Goal:** agent responses/reasoning should appear like the original CLI — generating and
printing sequentially, not popping in as a finished block.

### 13.1 What the backend actually sends (verified in code)
`useChatFeed` receives each reasoning chunk as **one complete `terminal_events` row**
(`event_type: 'output'`, whole text in `summary`) over Supabase Realtime — see
`useChatFeed.ts:123-130`. **There is no token stream.** So "printing sequentially" is a
**client-side reveal** applied to text that arrives whole. (If the backend later streams
partial `output` rows, the same component handles it — it reveals whatever text it's given.)

### 13.2 shadcn / Magic UI option (evaluated, not adopted directly)
Magic UI's **Terminal** system — `Terminal` + `TypingAnimation` (char-by-char, `duration`
ms/char, default 60) + `AnimatedSpan` (fade/fly-in), auto-sequenced with `startOnView` — is
*exactly* the desired feel. **But it is web-only**: DOM + `motion`/framer-motion + Tailwind.
It cannot render in React Native. The **react-native-reusables** (shadcn-for-RN) port does
**not** ship a terminal/typing primitive. So there is no drop-in shadcn RN component.

RN typewriter libraries exist (`react-native-typewriter-effect`, `react-native-type-animation`)
but they target looping marketing strings, and none integrate with our constraints below.

### 13.3 The hard constraint — virtualized recycling feed
The feed is a `FlatList` with `removeClippedSubviews`, memoized rows, `maintainVisibleContentPosition`,
and "auto-scroll only at the live edge". A naive typewriter would:
- **re-type every time a row recycles** (scroll away → back), and re-animate all history on load;
- **fight scroll anchoring** as the animating row grows in height.

So any solution MUST animate **only the single newest live row, exactly once**.

### 13.4 Decision — build a tiny native `useTypewriter` + terminal `OutputBubble`
Replicate the Magic UI *pattern* natively, dependency-free (reuse `react-native-reanimated`,
already installed, for the cursor blink / fade):

1. **`useTypewriter(text, { cps, enabled })`** hook — reveals `text` progressively with a
   timer (~`cps` 45–60 chars/sec), returns the visible slice + `done`. Honors
   `AccessibilityInfo.isReduceMotionEnabled` (reduced motion → instant full text).
2. **Reveal-once gating** — a `revealedIds` set (module-level ref) marks any output row that
   has finished (or been mounted as history). `enabled = isLiveEdge && !revealedIds.has(id)`.
   The screen already knows the live edge (`isNearBottomRef`, `feed[length-1]`), and
   `useChatFeed` distinguishes freshly-appended rows. Recycled/paginated rows → `enabled:false`
   → render full text instantly. This is the key correctness rule.
3. **Terminal presentation** — `OutputBubble` body becomes a mono block on `DarkColors.bg`
   with a blinking `▋` cursor while typing (Reanimated opacity loop), removed on `done`.
4. **AnimatedSpan feel for activity** — `ActivityBubble` fades/slides in (Reanimated
   `FadeInDown`) so tool lines "print" too, matching the Terminal look.
5. **No markdown during typing** — plain monospace matches the "original CLI" ask and avoids
   slicing markdown mid-syntax. (Optional later: render finalized text as markdown.)

**Why not a library / the web component:** the web shadcn/Magic UI Terminal is DOM-only;
RN typewriter libs don't do reveal-once inside a recycling virtualized list and would
re-animate on recycle. A ~40-line hook we control is safer and integrates with the existing
scroll/memoization logic.

### 13.5 New pieces this adds to the implementation plan
| File | Add |
|---|---|
| `src/hooks/useTypewriter.ts` | **New** — progressive reveal hook (+ reduce-motion) |
| `src/components/chat/TerminalText.tsx` | **New** — mono terminal text + blinking cursor (used by OutputBubble) |
| `ChatScreen.tsx` | Wire live-edge/reveal-once gating into `OutputBubble`; Reanimated fade for `ActivityBubble` |

Insert as steps **4a / 4b** in §11 (after the base bubbles, before RequestCard).

**Sources:**
[Magic UI — Terminal](https://magicui.design/docs/components/terminal),
[Magic UI — Typing Animation](https://magicui.design/docs/components/typing-animation),
[react-native-typewriter-effect](https://github.com/7nohe/react-native-typewriter-effect),
[react-native-type-animation](https://github.com/benjamineruvieru/react-native-type-animation),
[react-markdown-typewriter](https://github.com/DRincs-Productions/react-markdown-typewriter).

---

## Open question for you
Resolved: `cwd` moves to the status strip as `machineLabel`. If you later want the full
`cwd` path visible, I'll add a truncated line under the pill — say the word.
