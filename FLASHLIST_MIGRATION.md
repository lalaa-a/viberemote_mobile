# Migrating the chat feed from `FlatList` → `@shopify/flash-list` v2

> ✅ **STATUS: IMPLEMENTED** (`@shopify/flash-list@2.3.2`). `tsc` clean. Still needs the §7
> on-device test pass.
>
> Two things resolved during implementation that this guide had flagged as uncertain:
> 1. **`onStartReached` / `onStartReachedThreshold` DO exist in v2** (confirmed in
>    `FlashListProps.d.ts`) — no scroll-position fallback was needed.
> 2. **`startRenderingFromBottom: true` was WRONG for this app** — it bottom-anchors content,
>    so a new/short chat floats its few messages at the bottom with dead space above. Correct
>    setup is `startRenderingFromBottom: false` **plus**
>    `initialScrollIndex={feed.length - 1}`: a long conversation still opens on the newest
>    message, while short content simply has nothing to scroll and therefore fills from the
>    top and grows downward (normal chat behaviour).
> 3. **`contentContainerStyle` can't do `gap` or flex centring** with recycled cells, so:
>    - the old `gap: 12` became a per-row `marginBottom` (`styles.rowSpacing`, applied by a
>      wrapper `View` in `renderItem`);
>    - the empty state moved OUT of `ListEmptyComponent` and is rendered as a sibling of the
>      list inside `styles.emptyWrap` (`flex: 1, justifyContent: 'center'`) so it stays centred.

Target: `src/screens/Sessions/ChatScreen.tsx` (the only list that needs it).
Goal: eliminate the remaining streaming jank by replacing virtualization with **cell
recycling**, and hand scroll-position management to FlashList instead of doing it ourselves.

Read `CHAT_LOADING_AND_NAVIGATION.md` first for the history — it explains why we ended up on
an inverted `FlatList` and what broke before that.

---

## 1. Why this migration (and what changes conceptually)

Two separate wins:

**a) Recycling instead of virtualization.** `FlatList` unmounts/remounts rows as they leave
and re-enter the window. With variable-height chat rows and a live row whose height grows
while it types, that remount churn is what produces blank cells and dropped frames.
FlashList **recycles** the actual views, so scrolling stays smooth.

**b) A working `maintainVisibleContentPosition`.** We currently use an **inverted** list
specifically because RN's *native* MVCP drops the anchor when data updates faster than ~200ms
([facebook/react-native#53542](https://github.com/react/react-native/issues/53542)) — i.e. it
fails exactly during streaming.

> ⚠️ **Key architectural change:** FlashList v2 **deprecates the `inverted` prop.** Chat lists
> in v2 are rendered in *normal* order and use FlashList's own
> `maintainVisibleContentPosition` (a JS implementation, **enabled by default**, explicitly
> designed for chat/real-time feeds) with `startRenderingFromBottom: true`.

So this migration **reverts the inversion** and moves position-keeping to FlashList. That's a
net simplification — but it is a real re-architecture, not a drop-in swap. Budget accordingly.

---

## 2. Prerequisites — already satisfied

FlashList **v2 only works on React Native's New Architecture.** This project qualifies:

| Requirement | This repo | OK |
| --- | --- | --- |
| New Architecture | `android/gradle.properties → newArchEnabled=true` | ✅ |
| React Native | `0.85.3` | ✅ |
| React | `19.2.3` | ✅ |

If new arch were off, **stop** — v2 is not an option and you'd stay on the inverted FlatList.

---

## 3. Install

```bash
npm install @shopify/flash-list
cd ios && pod install && cd ..    # macOS only
```

v2 is JS-only (no native module), but a rebuild is still required because it ships with the
app bundle: `npm run android` / rebuild in Xcode. A Metro reload alone is not enough after
adding the dependency.

---

## 4. The `ChatScreen.tsx` changes

### 4.1 Imports and the ref type

v2 exports a dedicated ref type — `FlashList` is the *component*, `FlashListRef` is the ref.

```diff
-import { View, Text, FlatList, StyleSheet, ... } from 'react-native'
+import { View, Text, StyleSheet, ... } from 'react-native'
+import { FlashList, type FlashListRef } from '@shopify/flash-list'
```

```diff
-const listRef = useRef<FlatList>(null)
+const listRef = useRef<FlashListRef<ChatItem>>(null)
```

### 4.2 Un-invert: drop `invertedFeed`

`inverted` is deprecated in v2, so render `feed` in its natural oldest→newest order and
delete the reversed copy.

```diff
-// Render data for the inverted list: newest first.
-const invertedFeed = useMemo(() => feed.slice().reverse(), [feed])
```

### 4.3 Scroll helpers back to normal orientation

Un-inverted, "near the bottom" is again measured from the content end, and *latest* is the
end of the list.

```diff
 const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
-  const near = e.nativeEvent.contentOffset.y < 120
+  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
+  const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
+  const near = distanceFromBottom < 120
   setShowJumpToLatest(!near)
 }, [])

 const scrollToLatest = useCallback((animated = true) => {
-  listRef.current?.scrollToOffset({ offset: 0, animated })
+  listRef.current?.scrollToEnd({ animated })
   setShowJumpToLatest(false)
 }, [])
```

> **Do NOT** reintroduce any `onContentSizeChange` → `scrollToEnd` auto-follow. That is what
> FlashList's `maintainVisibleContentPosition` now does for us, and re-adding a manual scroll
> would recreate the exact fight we just removed.

### 4.4 Swap `listContent` padding back

The inverted container flipped top/bottom; un-inverted it's normal again.

```diff
 listContent: {
-  paddingHorizontal: Spacing.px16, paddingTop: Spacing.px16,
-  paddingBottom: Spacing.px12, gap: Spacing.px12,
+  paddingHorizontal: Spacing.px16, paddingTop: Spacing.px12,
+  paddingBottom: Spacing.px16, gap: Spacing.px12,
 },
```

### 4.5 `getItemType` — the biggest recycling win

Recycling works best when FlashList knows which rows share a shape. Our feed is
heterogeneous (`ChatItem` union), and the row types have wildly different heights — a
one-line `activity` row vs a multi-paragraph `output` block vs an approval `request` card.
Without this, FlashList recycles a tall card into a short row and has to re-layout.

Add next to `renderItem`:

```tsx
// Recycling hint: rows of the same type get reused for each other. Approval cards and
// question cards are the tall/expensive ones — keep them in their own pools.
const getItemType = useCallback((item: ChatItem) => {
  if (item.kind === 'request') return item.req.kind === 'question' ? 'question' : 'approval'
  return item.kind          // 'output' | 'activity' | 'sent' | 'notify' | 'stop'
}, [])
```

### 4.6 The list itself

```tsx
<FlashList
  ref={listRef}
  data={feed}                              // oldest → newest (natural order)
  keyExtractor={item => item.id}
  renderItem={renderItem}
  getItemType={getItemType}
  contentContainerStyle={styles.listContent}

  // FlashList's OWN position keeping — a JS implementation, on by default, built for chat.
  // This replaces both the `inverted` trick and RN's unreliable native MVCP.
  maintainVisibleContentPosition={{
    startRenderingFromBottom: true,   // open at the newest message, no visible snap
    autoscrollToBottomThreshold: 0.2, // follow new messages only when already near the bottom
    animateAutoScrollToBottom: false, // instant pin — animating fights fast streaming
  }}

  onScroll={handleScroll}
  scrollEventThrottle={16}

  // Older history is at the TOP again (natural order), so paginate from the start.
  onStartReached={fetchOlder}
  onStartReachedThreshold={0.3}

  ListHeaderComponent={isFetchingOlder
    ? <View style={styles.loadingOlder}><ActivityIndicator size="small" color={DarkColors.textTertiary} /></View>
    : null}
  ListFooterComponent={showThinking
    ? <ThinkingBubble isPendingApproval={pendingCount > 0} />
    : null}
  ListEmptyComponent={ /* unchanged */ }
/>
```

### 4.7 Delete the FlatList-only props

FlashList manages its own windowing/recycling — these are meaningless or harmful now:

```diff
-inverted
-windowSize={11}
-maxToRenderPerBatch={8}
-updateCellsBatchingPeriod={50}
-initialNumToRender={15}
-removeClippedSubviews={false}
-onEndReached={fetchOlder}
-onEndReachedThreshold={0.3}
```

Also **do not** add `estimatedItemSize` / `estimatedListSize` / `estimatedFirstItemOffset` —
removed in v2, FlashList measures automatically. (Every v1 tutorial you'll find still tells
you to add them; ignore that.)

---

## 5. Header/Footer orientation cheat-sheet

Easy to get backwards mid-migration:

| | Inverted FlatList (current) | FlashList v2 (after) |
| --- | --- | --- |
| Newest message | `data[0]`, at offset 0 | last item, at content end |
| Older pagination | `onEndReached` | `onStartReached` |
| Older-loading spinner | `ListFooterComponent` (renders top) | `ListHeaderComponent` (top) |
| Thinking indicator | `ListHeaderComponent` (renders bottom) | `ListFooterComponent` (bottom) |
| Jump-to-latest | `scrollToOffset({offset: 0})` | `scrollToEnd()` |
| "Near bottom" | `contentOffset.y < 120` | `contentSize - (offset + layout) < 120` |

---

## 6. What must NOT change

These were hard-won; the migration should leave them alone:

- **`feedTurn` boundary walk** — reads `feed` (oldest→newest). Unchanged by this migration.
- **`pendingAction` optimistic composer state** (`'sent'`/`'stopped'`) and its reconcile effect.
- **`refetchOnMount: 'always'`** in `useChatFeed` — the fix for "shows working after reopening".
- **`useTypewriter`'s ≤24-tick cap** — still worth keeping; fewer re-layouts is good for
  recycling too.
- **`itemCache` stable identities in `useChatFeed`** — *more* important now: recycling relies
  on `renderItem` being cheap and referentially stable.

---

## 7. Test checklist

Run on a **physical low-end Android device** — the simulator hides exactly the jank we're fixing.

1. **Open a chat with long history** → opens at the newest message, no visible snap from the top.
2. **Live streaming turn** → reasoning types out, list stays pinned to the bottom, no flicker,
   no blank rows. This is the whole point of the migration.
3. **Scroll up mid-stream** → the list stays where you put it, "Jump to latest" appears, new
   messages don't yank you down. Tap it → returns to the newest.
4. **Load older history** (scroll to top) → spinner at top, older messages prepend, **viewport
   does not jump**.
5. **Mixed content** → approval cards, question cards, tool activity rows, long code output all
   render at correct heights while scrolling fast (validates `getItemType`).
6. **Stop mid-turn** → "Stopped" divider appears, composer returns.
7. **Leave and reopen the chat** → still correct (guards the `refetchOnMount` behaviour).

---

## 8. Risks & rollback

| Risk | Mitigation |
| --- | --- |
| `onStartReached` support/behaviour differs in v2 | Verify first with a log. If unavailable, drive `fetchOlder` from `handleScroll` when `contentOffset.y < 300`. |
| MVCP autoscroll thresholds feel wrong | Tune `autoscrollToBottomThreshold` (0.1–0.3). Set `animateAutoScrollToBottom: false` if it feels laggy. |
| Recycling artifacts (stale content in a reused row) | Usually a missing/unstable `keyExtractor` or `getItemType`. Check both before blaming FlashList. |
| The typewriter row measured while growing | If the live row jitters, consider rendering the final text with an opacity fade instead of a height-growing typewriter. |
| New arch regression | v2 is new-arch only; if new arch is ever disabled, this must be reverted. |

**Rollback:** the migration is contained to `ChatScreen.tsx` (plus the dependency). Revert that
file to the inverted-`FlatList` version and `npm uninstall @shopify/flash-list`. Keep the change
on its own branch/commit so this is a one-liner.

---

## 9. Suggested commit order

1. `npm install @shopify/flash-list` + rebuild — confirm the app still boots.
2. Swap the component and ref type, keep everything else; confirm the chat renders.
3. Un-invert (drop `invertedFeed`, flip scroll helpers, swap header/footer, swap padding).
4. Add `maintainVisibleContentPosition`; delete the FlatList-only props.
5. Add `getItemType`.
6. Run the §7 checklist on a real device.
7. Update `CHAT_LOADING_AND_NAVIGATION.md` §3/§4 to record FlashList as the final state.

---

## 10. References

- [FlashList v2 — Shopify Engineering write-up](https://shopify.engineering/flashlist-v2)
- [Migrating to v2](https://shopify.github.io/flash-list/docs/v2-migration/)
- [What's new in v2](https://shopify.github.io/flash-list/docs/v2-changes/) — `maintainVisibleContentPosition`, `startRenderingFromBottom`, deprecation of `inverted`
- [FlashList usage / `getItemType`](https://shopify.github.io/flash-list/docs/usage/)
- [facebook/react-native#53542](https://github.com/react/react-native/issues/53542) — the native MVCP bug that forced the inverted workaround
