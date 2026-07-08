# Screen 05 — Request Detail (RequestDetailScreen)
> Part of the vibeRemote dark-navy UI redesign. Approval / question detail view.

---

## Approach

Built **shadcn-style in the existing system** — reusable primitives written in plain
`StyleSheet` + `DarkColors`, mirroring shadcn's variant API. **No NativeWind / no
build-config changes.** These primitives are the RN equivalents of shadcn's
`Button`, `Badge`, `Card`, and a shared back button.

### New reusable UI primitives — `src/components/ui/`

| File | shadcn analog | Variants / API |
|---|---|---|
| `BackButton.tsx` | — (shared nav control) | Circular chevron button; `onPress?`, `style?`. Defaults to `navigation.goBack()`. **Use on every dark screen.** |
| `Button.tsx` | `Button` | `variant`: `primary \| success \| destructive \| secondary`; `loading`, `disabled`, `onPress`, `style` |
| `Badge.tsx` | `Badge` | `variant`: `success \| warning \| danger \| critical \| neutral`; plus `RISK_VARIANT` map (`RiskLevel → BadgeVariant`) |
| `Card.tsx` | `Card` | `Card` = surface (`#143753`), `CardStrip` = raised header strip (`#164269`) |

---

## Color tokens added to `DarkColors`

| Token | Hex | Usage |
|---|---|---|
| `approve` | `#27E07E` | Approve / success button |
| `danger` | `#EF5350` | Deny button, high-risk badge |
| `dangerDeep` | `#B71C1C` | Critical-risk badge |

(`online` `#27E07E` was already added for the Machines screen; `approve` is an alias for clarity.)

---

## Screen anatomy (top → bottom)

```
details                         ← title (Bitcount)
( ‹ )  [ directory_last_part ]  ← back row: circular BackButton + directory pill
┌─────────────────────────────┐
│ [ Edit            [high] ]   │ ← Card > CardStrip: tool_name + risk Badge
│ Changing_file_full_directory │ ← summary
│   ▣        shield       ◷     │ ← icon row: machine · risk · time
└─────────────────────────────┘
┌─────────────────────────────┐
│ diff screen                  │ ← Card wrapping DiffViewer / command / files
│                              │
└─────────────────────────────┘
┌─────────────────────────────┐
│  [ Deny ]      [ Approve ]   │ ← sticky footer (rounded top), Button variants
└─────────────────────────────┘
   💬      ▦      ⚙            ← global floating tab bar
```

### 1. Header + back row
- `details` — `FontFamily.bitcount`, size 24, `textPrimary`.
- **Back row** = `<BackButton />` (circular, `surfaceRaised`) + a **directory pill**
  (`surfaceRaised`, `Radius.full`) showing the last path segment of
  `file_path`/`files_affected[0]`, falling back to the machine label.

### 2. Header card (`Card` + `CardStrip`)
- **Strip** (`#164269`): `tool_name` (bold) on the left, risk **`Badge`** on the right.
  Risk → variant via `RISK_VARIANT` (low→success, medium→warning, high→danger, critical→critical).
- **Summary** text below the strip.
- **Icon row**: three centered items — machine (`desktop-outline` + online dot + label),
  risk (`shield-outline` + level), time (`time-outline` + relative time). Icons carry a
  small value label so the row stays informative (the mockup shows icons only).

### 3. Content cards
Command, files, and diff each get their own `Card`:
- **Bash command** — dark code block, `$` prefix in green, mono text.
- **Files** — one `document-outline` row per affected path.
- **Diff** — `CHANGES · +n −m` label + existing `DiffViewer`.
  > Note: `DiffViewer` still uses the light `Colors` palette internally — a dark pass on
  > that component is tracked as a follow-up; it renders inside the dark `Card` for now.

### 4. Decision states
- **Decided** requests show a `Card` banner (check/close icon + "Approved/Denied via …")
  instead of the footer.
- **Pending** requests show the **sticky footer**: `Deny` (`destructive`) +
  `Approve` (`success`) `Button`s, rounded top corners, `surface` background, sitting
  above the global tab bar (`insets.bottom + 96`).

### 5. Question requests (`kind === 'question'`)
Same header/back row, but the body renders the existing `QuestionCard` picker.
> `QuestionCard` is still light-themed — dark restyle tracked as follow-up.

---

## Files changed / added

| File | Change |
|---|---|
| `src/constants/colors.ts` | Added `approve`, `danger`, `dangerDeep` to `DarkColors` |
| `src/components/ui/BackButton.tsx` | **New** — shared circular back button |
| `src/components/ui/Button.tsx` | **New** — variant button |
| `src/components/ui/Badge.tsx` | **New** — variant badge + `RISK_VARIANT` |
| `src/components/ui/Card.tsx` | **New** — `Card` + `CardStrip` |
| `src/screens/Requests/RequestDetailScreen.tsx` | Full dark rewrite using the primitives |

---

## Follow-ups
1. **Adopt `BackButton` everywhere** — replace the ad-hoc back rows on other screens for one consistent control.
2. **Dark pass on `DiffViewer`** — it still reads from light `Colors`.
3. **Dark pass on `QuestionCard`** — same.
4. Swap harness/tool icons for the incoming SVGs (shared with the nav bar + Machines bubbles).
