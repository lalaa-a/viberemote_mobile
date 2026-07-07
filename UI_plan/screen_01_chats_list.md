# Screen 01 — Chats List (SessionsScreen)
> Part of the vibeRemote dark-navy UI redesign. Designed screen-by-screen.

---

## 0. Typography — fonts to install

### Font assignments

| Usage | Font | Variant / weight |
|---|---|---|
| App name / title ("vibeRemote") | **Bitcount** | Single or Grid variant, Regular |
| All body text, labels, UI copy | **Google Sans Flex** | Variable font — weight 400–700 |

> **Why these two**: Bitcount is a pixel-grid display font that gives "vibeRemote" its bitmap retro-tech look. Google Sans Flex is a clean, modern variable sans-serif — readable at all sizes and weights with a single font file.

---

### 0.1 Download the font files

**Bitcount** — available on Google Fonts:
- URL: `https://fonts.google.com/specimen/Bitcount+Grid+Single` (or Double variant)
- Download the `.ttf` files. Variants to grab:
  - `BitcountGridSingle-Regular.ttf` (for the app name title)

**Google Sans Flex** — available on Google Fonts:
- URL: `https://fonts.google.com/specimen/Google+Sans+Flex`
- Download the variable font file:
  - `GoogleSansFlex[wght].ttf` (single variable file covers all weights)

---

### 0.2 Add font files to the project

React Native fonts live in `android/app/src/main/assets/fonts/` (Android) and are declared in `ios/AgentControl/Info.plist` (iOS). The project's `react-native.config.js` already points to `./assets/fonts/` for `npx react-native-asset` linking.

**Step 1** — create the assets directory (it doesn't exist yet):
```
AgentControl/
  assets/
    fonts/
      BitcountGridSingle-Regular.ttf
      GoogleSansFlex[wght].ttf
```

**Step 2** — run the font linker to copy files into both platforms automatically:
```bash
cd AgentControl
npx react-native-asset
```

This writes to `android/app/src/main/assets/fonts/` and patches `ios/AgentControl/Info.plist` with `UIAppFonts` entries — no manual Xcode drag-and-drop needed.

**Step 3** — rebuild the native app (font changes require a full build, not just Metro reload):
```bash
# Android
npx react-native run-android

# iOS
npx react-native run-ios
```

---

### 0.3 Register in `src/constants/colors.ts`

Add to the `FontFamily` export:

```typescript
export const FontFamily = {
  // ── existing ──────────────────────────────────
  serif:       'Fraunces-Regular',
  serifBold:   'Fraunces-SemiBold',
  serifItalic: 'Fraunces-Italic',
  sans:        'Inter',
  loraItalic:  'Lora-MediumItalic',
  mono:        Platform.OS === 'ios' ? 'Menlo' : 'JetBrainsMono-Regular',

  // ── new dark UI fonts ──────────────────────────
  // Used for the "vibeRemote" app name header
  bitcount:    'BitcountGridSingle-Regular',
  // Used for all body text, labels, buttons in dark screens
  googleSans:  'GoogleSansFlex',
}
```

> **Font name strings**: React Native uses the PostScript name embedded in the font file, not the file name. Verify the exact PostScript name after installing by checking with a font viewer, or test on device — if the font doesn't render, the name is wrong. Common pattern: `BitcountGridSingle-Regular`, `GoogleSansFlex`.

---

### 0.4 Font usage map for Screen 01

| Element | fontFamily | fontSize | fontWeight |
|---|---|---|---|
| App name "vibeRemote" | `FontFamily.bitcount` | `24` | `'400'` (Bitcount has its own weight baked in) |
| Section chips / filter labels | `FontFamily.googleSans` | `13` | `'500'` |
| Session card — directory name | `FontFamily.googleSans` | `15` | `'600'` |
| Session card — timestamp | `FontFamily.googleSans` | `12` | `'400'` |
| Session card — status label | `FontFamily.googleSans` | `12` | `'500'` |
| Session card — machine name | `FontFamily.googleSans` | `12` | `'400'` |
| Search bar placeholder / input | `FontFamily.googleSans` | `15` | `'400'` |
| Pending badge number | `FontFamily.googleSans` | `10` | `'700'` |
| Empty state title | `FontFamily.googleSans` | `24` | `'500'` |
| Empty state subtitle | `FontFamily.googleSans` | `15` | `'400'` |
| Tab bar (no labels) | — | — | — |

---

## Reference wireframe summary

The wireframe shows a full dark-navy chat list screen with these main zones, top-to-bottom:

```
┌─────────────────────────────────────┐
│  vibeRemote                         │  ← header (logo text)
│  ┌───────────────────────────────┐  │
│  │ 🔍  Search Conversations      │  │  ← search bar (pill)
│  └───────────────────────────────┘  │
│  [──────────────────────────────]   │  ← machine filter strip
│                                     │
│  ┌─────────────────────────────────┐│
│  │ [avatar] directory_last_name time ││  ← session card
│  │          ● status  machine_name  ││
│  └─────────────────────────────────┘│
│  [avatar]                           │  ← card 2 (opencode)
│  [avatar]                           │  ← card 3 (gemini-cli)
│                                     │
│          …                          │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  💬      ▦      ⚙           │   │  ← floating tab pill
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

---

## 1. Color palette (new dark theme)

These colors replace the existing warm-cream palette **only for the dark screens**. Add a `DarkColors` export to `src/constants/colors.ts` — do not remove the existing `Colors` object (other screens may still use it during the phased rollout).

| Token | Hex / value | Usage |
|---|---|---|
| `bg` | `#082134` | Main screen background |
| `surface` | `#143753` | Cards, search bar, tab pill |
| `surfaceRaised` | `#164269` | Elevated elements, active filter chips |
| `border` | `rgba(255,255,255,0.06)` | Dividers, card bottom borders |
| `borderMid` | `rgba(255,255,255,0.10)` | Search bar outline, pill border |
| `textPrimary` | `#FFFFFF` | Session title, primary labels |
| `textSecondary` | `rgba(255,255,255,0.65)` | Machine name, secondary text |
| `textTertiary` | `rgba(255,255,255,0.40)` | Timestamp, placeholder, inactive icon |
| `statusActive` | `#4CAF50` | Active session dot + label |
| `statusIdle` | `#FFA726` | Idle session dot + label |
| `statusFinished` | `rgba(255,255,255,0.30)` | Finished / closed session dot + label |
| `badgeBg` | `#1976D2` | Pending count badge (blue — not red) |
| `badgeText` | `#FFFFFF` | Badge number |
| `tabActive` | `#FFFFFF` | Active tab icon |
| `tabInactive` | `rgba(255,255,255,0.40)` | Inactive tab icon |
| `tabChipActive` | `rgba(255,255,255,0.12)` | Active tab icon background chip |

```typescript
// src/constants/colors.ts — append below existing exports
export const DarkColors = {
  bg:            '#082134',
  surface:       '#143753',
  surfaceRaised: '#164269',
  border:        'rgba(255,255,255,0.06)',
  borderMid:     'rgba(255,255,255,0.10)',
  textPrimary:   '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary:  'rgba(255,255,255,0.40)',
  statusActive:  '#4CAF50',
  statusIdle:    '#FFA726',
  statusFinished:'rgba(255,255,255,0.30)',
  badgeBg:       '#1976D2',
  badgeText:     '#FFFFFF',
  tabActive:     '#FFFFFF',
  tabInactive:   'rgba(255,255,255,0.40)',
  tabChipActive: 'rgba(255,255,255,0.12)',
}

export const DarkStatusColor: Record<string, string> = {
  active:   DarkColors.statusActive,
  idle:     DarkColors.statusIdle,
  finished: DarkColors.statusFinished,
  closed:   DarkColors.statusFinished,
}
```

---

## 2. Screen anatomy & component specs

### 2.1 Header

| Property | Value |
|---|---|
| Layout | `flexDirection: row`, `justifyContent: space-between`, `alignItems: center` |
| `paddingTop` | `insets.top + 12` |
| `paddingHorizontal` | `20` |
| `paddingBottom` | `12` |

**App name text**
- Text: `"vibeRemote"` (lowercase `v`, no subtitle)
- Font: `FontFamily.bitcount` (`'BitcountGridSingle-Regular'`) — pixel-grid display font
- Font size: `24`
- Color: `DarkColors.textPrimary`
- Font weight: `'400'` (Bitcount's weight is baked into the letterforms; don't set 700)

No `LiveBadge` in header — remove or relocate.

---

### 2.2 Search bar

Placed directly below the header, above the machine filter strip.

```
Margin: horizontal 20, bottom 12
Height: 44
Background: DarkColors.surface
Border: 1px DarkColors.borderMid
BorderRadius: Radius.full (999)
```

**Internal layout** — `flexDirection: row`, `alignItems: center`, `paddingHorizontal: 14`, `gap: 10`

| Sub-element | Spec |
|---|---|
| Search icon | `Ionicons name="search-outline"`, size `18`, color `DarkColors.textTertiary` |
| `TextInput` | `flex: 1`, `color: DarkColors.textPrimary`, `placeholderTextColor: DarkColors.textTertiary`, `placeholder: "Search Conversations"`, `fontSize: FontSize.body (15)` |

> Search filters the visible `filtered` array locally on `session.cwd` (directory name) and `session.machine_label`. No API call needed.

State: `const [query, setQuery] = useState('')` in `SessionsScreen`.

---

### 2.3 Machine filter strip

Keeps the existing `MachineChips` horizontal scroll, restyled for dark theme.

| Property | Current | New |
|---|---|---|
| Chip background | `Colors.surfaceGlassStrong` | `DarkColors.surface` |
| Chip active bg | `Colors.accentLight` | `DarkColors.surfaceRaised` |
| Chip text | `Colors.textSecondary` | `DarkColors.textSecondary` |
| Chip active text | `Colors.accentDeep` | `DarkColors.textPrimary` |
| Chip border | `Colors.borderHairline` | `DarkColors.border` |
| Chip active border | `Colors.accent + '80'` | `DarkColors.borderMid` |
| Online dot | `Colors.success` | `DarkColors.statusActive` |
| Offline dot | `Colors.borderHairline` | `DarkColors.statusFinished` |

---

### 2.4 Session card (`SessionCard`)

**Card wrapper**

```
flexDirection: row
alignItems: center
gap: 12
paddingVertical: 12
paddingHorizontal: 20
backgroundColor: transparent   (main bg shows through)
borderBottomWidth: 1
borderBottomColor: DarkColors.border
```

---

#### 2.4.1 Harness avatar

Replaces the current single-letter avatar with a harness-specific icon. This requires a new `HarnessAvatar` component.

**Container**
```
width: 48, height: 48
borderRadius: Radius.full (999)
backgroundColor: DarkColors.surface
borderWidth: 2
borderColor: <status dot color> + '60'   (same logic as current)
alignItems: center, justifyContent: center
position: relative
flexShrink: 0
```

**Icon inside** — harness determines the icon:

| HarnessId | Icon | Notes |
|---|---|---|
| `claude-code` | Ionicons `"cube-outline"` or an inline SVG robot | The wireframe shows an orange pixel robot — use `HarnessBadge` icon logic |
| `opencode` | Ionicons `"document-outline"` | File/document icon (black on dark bg) |
| `gemini-cli` | Ionicons `"terminal-outline"` | `>` prompt look |
| unknown / fallback | First letter of `dir` | Same as current, uppercase, `FontFamily.serifBold` |

Icon size: `24`, color: `DarkColors.textPrimary` or harness-specific accent.

**Active dot** (bottom-right corner, when `session.status === 'active'`)
```
position: absolute
bottom: 1, right: 1
width: 12, height: 12
borderRadius: Radius.full
backgroundColor: DarkColors.statusActive
borderWidth: 2
borderColor: DarkColors.bg   (matches main bg so it cuts out of avatar)
```

---

#### 2.4.2 Card body

```
flex: 1
gap: 4
```

**Top row** — `flexDirection: row`, `alignItems: center`, `justifyContent: space-between`, `gap: 8`

| Element | Spec |
|---|---|
| Directory name | `fontSize: FontSize.cardTitle (17)`, `fontWeight: '600'`, `color: DarkColors.textPrimary`, `numberOfLines: 1`, `flex: 1` |
| Timestamp | `fontSize: FontSize.metadata (12)`, `color: DarkColors.textTertiary`, `flexShrink: 0` |

**Bottom row** — `flexDirection: row`, `alignItems: center`, `justifyContent: space-between`, `gap: 8`

Left cluster (`flexDirection: row`, `alignItems: center`, `gap: 5`, `flex: 1`):

| Element | Spec |
|---|---|
| Status dot | `width: 6`, `height: 6`, `borderRadius: full`, `backgroundColor: DarkStatusColor[status]` |
| Status label | `fontSize: FontSize.metadata (12)`, `fontWeight: '500'`, `color: DarkStatusColor[status]` |
| Separator `·` | `fontSize: 12`, `color: DarkColors.textTertiary` |
| Machine name | `fontSize: 12`, `color: DarkColors.textTertiary`, `flex: 1`, `numberOfLines: 1` |

---

#### 2.4.3 Pending badge

Shown on the right when `session.pending_count > 0`.

```
backgroundColor: DarkColors.badgeBg   (#1976D2 — blue)
borderRadius: Radius.full
minWidth: 20, height: 20
alignItems: center, justifyContent: center
paddingHorizontal: 4
flexShrink: 0
```

Badge text: `fontSize: 10`, `fontWeight: '700'`, `color: DarkColors.badgeText`.

> **Key difference from current**: The badge is **blue** (#1976D2), not red. This matches the wireframe and visually separates "pending decisions" from "danger/error" states.

---

### 2.5 Empty state

Same layout as current but adapted:

- Icon: `Ionicons name="flash-outline"` size `48`, color `DarkColors.textSecondary`
- Icon wrap: `backgroundColor: DarkColors.surface`, `borderRadius: full`
- Title: `"No sessions\nrunning."` — `DarkColors.textPrimary`
- Subtitle: `DarkColors.textSecondary`

---

### 2.6 Floating tab bar (RootNavigator)

The wireframe shows 3 icon-only tabs in a pill with no text labels. Icons change from current:

| Tab | Current icon | New icon | Notes |
|---|---|---|---|
| ChatsTab | `chatbubbles` | `chatbubble-ellipses` | single bubble |
| MachinesTab | `server` | `grid` or `barcode` | grid-style icon |
| ProfileTab | `person` | `settings` | gear icon |

**Pill style**

```
backgroundColor: DarkColors.surface   (#143753)
borderWidth: 1
borderColor: DarkColors.borderMid
```

**Active chip** (the highlight behind the active tab icon):
```
backgroundColor: DarkColors.tabChipActive   (rgba(255,255,255,0.12))
```

**Icon colors**
```
active:   DarkColors.tabActive   (#FFFFFF)
inactive: DarkColors.tabInactive  (rgba(255,255,255,0.40))
```

Remove the text label entirely — icon only. The `TAB_META` label field is no longer rendered.

---

## 3. Status dot colors — full reference

```typescript
// Used in SessionCard and avatar border
const DarkStatusColor: Record<string, string> = {
  active:   '#4CAF50',                  // green
  idle:     '#FFA726',                  // amber
  finished: 'rgba(255,255,255,0.30)',   // muted white
}

function getStatusColor(session: AgentSession): string {
  if (session.cli_alive === false && session.status !== 'active') {
    return 'rgba(255,255,255,0.20)'     // very muted = CLI window closed
  }
  return DarkStatusColor[session.status] ?? 'rgba(255,255,255,0.30)'
}
```

---

## 4. Files to change

| File | What changes |
|---|---|
| `assets/fonts/` | New directory — add `BitcountGridSingle-Regular.ttf` + `GoogleSansFlex[wght].ttf` |
| `react-native.config.js` | Already points to `./assets/fonts/` — run `npx react-native-asset` after adding files |
| `ios/AgentControl/Info.plist` | Auto-patched by `react-native-asset` with `UIAppFonts` entries |
| `src/constants/colors.ts` | Add `FontFamily.bitcount` + `FontFamily.googleSans`; add `DarkColors`, `DarkStatusColor` |
| `src/screens/Sessions/SessionsScreen.tsx` | Full style overhaul + search bar + HarnessAvatar + new fonts |
| `src/navigation/RootNavigator.tsx` | Dark pill colors, new tab icons, remove text labels |
| `src/components/HarnessBadge.tsx` | Read for reuse — its icon map feeds `HarnessAvatar` |

New component to create:
| File | Purpose |
|---|---|
| `src/components/HarnessAvatar.tsx` | Renders harness-specific icon inside the 48×48 circle avatar |

---

## 5. Implementation order

1. **Font installation** — download TTF files → `assets/fonts/` → `npx react-native-asset` → rebuild native app
2. **`colors.ts`** — add `FontFamily.bitcount` + `FontFamily.googleSans`; add `DarkColors` + `DarkStatusColor`
3. **`HarnessAvatar.tsx`** — new component, no dependencies on existing screens
4. **`SessionsScreen.tsx`** — swap styles + search bar + use `HarnessAvatar` + new fonts
5. **`RootNavigator.tsx`** — update pill + icon names last (affects all tabs)

---

## 6. Next screens in series

| # | Screen | File |
|---|---|---|
| 02 | Chat (conversation detail) | `ChatScreen.tsx` |
| 03 | Machines list | `MachinesScreen.tsx` |
| 04 | Profile / Settings | `ProfileScreen.tsx` |
| 05 | Request detail | `RequestDetailScreen.tsx` |
| 06 | Sign-in / Sign-up | `SignInScreen.tsx`, `SignUpScreen.tsx` |
