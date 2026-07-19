# Chat Loading & Navigation — Architecture, Best Practices, and Fixes

This document explains how the live chat feed (`ChatScreen`) should load and scroll,
why the current implementation jitters ("scrolling just goes up and down") while the
agent is working, the fix that was applied, and the recommended longer-term
architecture. It also covers navigation (React Navigation vs react-native-navigation)
since the two topics are related to how screens mount and how the list behaves.

---

## 1. The problem

While a turn is live (reasoning/tool output streaming in), the message list in
`src/screens/Sessions/ChatScreen.tsx`:

- fights itself when auto-scrolling, so the viewport bounces up and down;
- makes the newest messages hard to read because it keeps re-scrolling mid-render;
- feels janky, especially during the character-by-character "typing" of reasoning
  output (`TerminalText`).

### Root causes (before the fix)

1. **Two competing auto-scrolls on every new message.**
   - `useEffect(..., [feed.length])` → `scrollToEnd({ animated: true })` (a slow,
     _animated_ scroll).
   - `onContentSizeChange` → `scrollToEnd({ animated: false })` (an _instant_ scroll).

   When a message arrives, both fire. The animated scroll is still travelling when
   the instant one snaps to the bottom, and `maintainVisibleContentPosition` is
   simultaneously trying to hold a visible item in place. The three pull against each
   other → visible oscillation.

2. **Streaming height growth spams `onContentSizeChange`.**
   `TerminalText` grows the content height frame-by-frame as it types. Each growth
   fires `onContentSizeChange`, which fired a fresh `scrollToEnd` **every frame**
   with no coalescing.

3. **`maintainVisibleContentPosition` + `scrollToEnd` on the same list.**
   MVCP only adjusts scroll for content changes _above_ the anchored item, and
   `scrollToEnd` handles the bottom — so they _can_ coexist, but only if exactly one
   scroll path drives the live edge. With two scroll paths (point 1) the anchoring
   made the bounce worse.

---

## 2. How chat lists should scroll — the mental model

A chat feed has two independent behaviours that must not fight:

| Situation | Desired behaviour |
| --- | --- |
| User is at/near the bottom, new message arrives | Smoothly pin to the newest message |
| User has scrolled up to read history | **Do not** move them; show a "jump to latest" affordance |
| Older page loads at the top (pagination) | Keep the currently-visible messages exactly where they are (no jump) |
| A message at the live edge grows (streaming text) | Keep the bottom pinned _if_ the user is at the bottom; otherwise leave them alone |

The golden rules:

1. **One scroll authority.** Never run two `scrollTo*` calls for the same event.
   Pick a single trigger (content-size change) and a single animation mode.
2. **Only follow when near the bottom.** Track "is the user near the bottom" from
   `onScroll`; only auto-scroll when that flag is true.
3. **Coalesce.** Rapid size changes (streaming) must collapse into at most one scroll
   per frame (`requestAnimationFrame`), never one per size-change event.
4. **Preserve position on prepend.** Loading older messages must not shift the
   viewport — that's exactly what `maintainVisibleContentPosition` is for.
5. **Instant, not animated, for "follow".** Auto-follow should be `animated: false`
   (a pin). Reserve `animated: true` for the explicit "jump to latest" button.

---

## 3. Three implementation strategies (trade-offs)

### A. Non-inverted `FlatList` + disciplined auto-follow  ← **applied here**

Keep the natural oldest→newest data order. Follow the bottom with a single,
coalesced, near-bottom-gated pin, and use `maintainVisibleContentPosition` only to
stop older-page loads from jumping.

- **Pros:** smallest change; data stays in natural order; pagination and empty/footer
  logic stay as-is; works the same on iOS and Android.
- **Cons:** you still manage the "follow the bottom" pin yourself.
- **When:** the pragmatic fix for an existing screen (our case).

### B. Inverted `FlatList` (`inverted` prop)

Reverse the data (newest first) and let the list render bottom-up. The newest message
sits at scroll offset 0 (the bottom), so new messages appear automatically with **no**
`scrollToEnd`. Load older via `onEndReached` (now the top).

- **Pros:** the canonical chat pattern; the "follow newest" behaviour is free;
  streaming growth at the bottom stays pinned automatically.
- **Cons:** you must flip everything — reverse data, swap `onStartReached` ↔
  `onEndReached`, and remember `ListHeaderComponent` renders at the **bottom** and
  `ListFooterComponent` at the **top**. Historically janky on Android with very large
  lists. Accessibility reading order needs care.
- **When:** a from-scratch chat screen, or when the manual pin still isn't smooth
  enough.

### C. `@shopify/flash-list` (`FlashList`)

A drop-in-ish replacement for `FlatList` that recycles views instead of unmounting
them. Much lower memory and far fewer blank cells during fast scroll. Supports
`maintainVisibleContentPosition` and an inverted-style `initialScrollIndex`.

- **Pros:** best raw performance for long, fast-updating lists; fewer dropped frames.
- **Cons:** extra dependency; needs `estimatedItemSize`; some `FlatList` props differ.
- **When:** if the feed grows to thousands of rows or streaming still drops frames
  after strategy A.

**Recommendation:** ship **A** now (done). If streaming smoothness is still not good
enough on low-end Android, migrate the list to **C** (FlashList) — it's the least
disruptive high-performance upgrade. Reserve **B** only if you rebuild the screen.

---

## 4. The fix that was applied (strategy A)

In `src/screens/Sessions/ChatScreen.tsx`:

1. **Removed the `useEffect(..., [feed.length])` animated `scrollToEnd`** — this was
   the second, competing scroll. New messages already trigger `onContentSizeChange`,
   so following the bottom there is sufficient.
2. **Added a single coalesced "follow bottom" helper** that schedules at most one
   `scrollToEnd({ animated: false })` per frame via `requestAnimationFrame`, guarded
   by a `followScheduled` ref. Streaming growth now collapses to one pin per frame
   instead of one per size-change event.
3. **`onContentSizeChange` is the sole auto-follow trigger**, gated on
   `isNearBottomRef` (near bottom) and the initial mount.
4. **Kept `maintainVisibleContentPosition`** purely for older-page loads (no jump on
   prepend) — it no longer competes because there is now exactly one live-edge scroll
   path.
5. **`scrollToLatest` (the "Jump to latest" button)** keeps `animated: true` — the one
   place an animated scroll is appropriate, because it's a deliberate user action.

Net effect: at the bottom, the list pins smoothly to new/streaming content; scrolled
up, it stays put and shows "Jump to latest"; older loads don't jump.

### Follow-up smoothness fixes (streaming flicker)

The steps above stopped the scroll _bounce_, but the live feed was still flickery while
a turn streamed. Two more root causes, both fixed:

6. **The typewriter thrashed layout + scroll.** `useTypewriter` revealed text on a
   timer that could run **hundreds of ticks** for one block (`perTick = len/400`,
   `stepMs = 20`). Each tick re-renders the live row, grows its height, fires
   `onContentSizeChange`, and triggers a scroll pin — dozens of times per second.
   Fixed by capping the whole reveal to **≤ ~24 ticks** at a frame-friendly interval
   (`perTick = ceil(len / 24)`, `stepMs = max(16, 1000/cps)`), so a long block reveals
   in under ~0.5s with ~24 re-renders instead of hundreds. The typing feel stays.

7. **`removeClippedSubviews` blanked/flickered rows on Android.** It detaches
   off-screen rows and is a well-known source of rows flickering, especially with
   variable heights and the live row growing. Set to `false`; `windowSize` still caps
   memory.

If streaming still isn't perfectly smooth after these, that's the signal to move to an
**inverted `FlatList`** (§3-B, the growing live row pins at the bottom automatically
with no scroll calls) or **FlashList** (§3-C).

### If you later go to FlashList (strategy C)

- `yarn add @shopify/flash-list`
- Swap `FlatList` → `FlashList`, add `estimatedItemSize={72}` (tune to the average row).
- Keep the same `onContentSizeChange` follow logic and `maintainVisibleContentPosition`.
- Drop `removeClippedSubviews`, `windowSize`, `maxToRenderPerBatch` — FlashList
  manages recycling itself.

---

## 5. Reference resources

- React Native — `FlatList`: https://reactnative.dev/docs/flatlist
- React Native — `ScrollView#maintainVisibleContentPosition`:
  https://reactnative.dev/docs/scrollview#maintainvisiblecontentposition
- React Native — `VirtualizedList` performance:
  https://reactnative.dev/docs/optimizing-flatlist-configuration
- Inverted lists for chat (`inverted` prop): https://reactnative.dev/docs/flatlist#inverted
- Shopify FlashList: https://shopify.github.io/flash-list/
- FlashList `maintainVisibleContentPosition`:
  https://shopify.github.io/flash-list/docs/guides/maintain-visible-content-position

---

## 6. Navigation — React Navigation vs react-native-navigation

There are two well-known libraries and the names are easy to confuse:

- **React Navigation** (`@react-navigation/*`) — JS-driven, the de-facto standard,
  huge ecosystem. Its `native-stack` uses the platform's native stack primitives
  (`UINavigationController` / `Fragment`), so it's fast and feels native.
  **This app already uses it** (`@react-navigation/native`, `native-stack`,
  `bottom-tabs` — see `src/navigation/RootNavigator.tsx`).
- **react-native-navigation** (Wix, the package literally named
  `react-native-navigation`) — fully native navigation with each screen as a native
  root. Marginally smoother transitions on very heavy screens, but heavier native
  setup (touches `MainActivity`/`AppDelegate`) and a bigger migration cost.

**Recommendation: stay on React Navigation.** The app is already set up correctly with
`native-stack`, which gives native transitions without the migration cost of the Wix
library. Migrating would be a large, risky change for little practical gain here.

### How this ties back to the chat scroll

Navigation choice affects the list because screens **mount/unmount** on navigation:

- On this stack, `Chat` is a `native-stack` screen; leaving and returning **remounts**
  it, which resets local state (this is intentionally handled elsewhere — e.g. the
  optimistic stop/send state — but it also resets scroll position and the
  `didInitialScroll` guard, so the initial "scroll to bottom on open" must be robust).
- Full-screen chat routes hide the floating tab bar via `HIDE_TAB_BAR_ROUTES`
  (`RootNavigator.tsx`), so the list's bottom inset doesn't jump when entering a chat.

### React Navigation best practices used / recommended here

- **Use `native-stack`** (already done) over the JS `stack` for native gestures/perf.
- **`getFocusedRouteNameFromRoute`** to hide the tab bar on detail screens (already
  done) — keeps the compose bar anchored without layout jumps.
- **Memoize screen options** and avoid inline functions in `screenOptions` where they
  cause re-renders.
- **Keep heavy screens cheap to remount**: rely on React Query caches (already in use)
  so returning to `Chat` re-reads cached feed pages instead of refetching from scratch.
- **Deep-linking / notifications**: route push-notification taps through
  `navigationRef` (already present) rather than ad-hoc navigation.

### Navigation reference resources

- React Navigation docs: https://reactnavigation.org/docs/getting-started
- Native Stack: https://reactnavigation.org/docs/native-stack-navigator
- Bottom Tabs: https://reactnavigation.org/docs/bottom-tab-navigator
- react-native-navigation (Wix): https://wix.github.io/react-native-navigation/
