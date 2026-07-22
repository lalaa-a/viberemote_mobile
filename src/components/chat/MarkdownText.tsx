import React from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import { useMarkdown, type MarkedStyles } from 'react-native-marked'
import { DarkColors, Spacing, Radius, FontSize, FontFamily } from '../../constants/colors'

/**
 * Agent output is Markdown (**bold**, `code`, fenced blocks, lists, headings, tables).
 * Rendering it as plain text showed the raw syntax, so this renders it properly.
 *
 * Uses the `useMarkdown` HOOK, not the <Markdown /> component: the component wraps its output
 * in its own FlatList, and nesting a list inside our FlashList would break virtualization.
 * The hook just returns elements we render in a plain View.
 *
 * Memoized because the parse runs on every render and these rows live inside a recycling
 * FlashList — re-parsing on unrelated re-renders would be the expensive path.
 */
function MarkdownTextBase({ text }: { text: string }) {
  const elements = useMarkdown(text, { colorScheme: 'dark', styles: mdStyles, theme: mdTheme })
  return <View style={styles.wrap}>{elements}</View>
}

export const MarkdownText = React.memo(
  MarkdownTextBase,
  (prev, next) => prev.text === next.text,
)

const mdTheme = {
  colors: {
    text:   DarkColors.textPrimary,
    link:   DarkColors.online,
    code:   'rgba(255,255,255,0.06)',
    border: DarkColors.border,
  },
}

// Bold weight, per platform:
//   • Android — use the real Google Sans Flex Bold face (static, instanced from the variable
//     font by scripts/make-bold-font.py). Android can't reach a variable font's weight axis
//     via fontWeight, so a dedicated single-weight family is the only way to get true bold.
//     No fontWeight here — the family is already bold, and adding it risks a synthetic
//     double-bold on top.
//   • iOS — the bold .ttf isn't bundled into the Xcode project yet, and iOS synthesizes a
//     real bold from any family via fontWeight, so keep that. (To use the real face on iOS
//     too: add GoogleSansFlex-Bold.ttf to the Xcode target and switch this to the family.)
const bold = Platform.OS === 'android'
  ? { fontFamily: FontFamily.googleSansBold }
  : { fontFamily: FontFamily.googleSans, fontWeight: '700' as const }

const heading = { color: DarkColors.textPrimary, ...bold }

const mdStyles: MarkedStyles = {
  text: {
    color: DarkColors.textPrimary,
    fontFamily: FontFamily.googleSans,
    fontSize: FontSize.body,
    lineHeight: 22,
  },
  strong:        { ...bold, color: DarkColors.textPrimary },
  em:            { fontStyle: 'italic' },
  strikethrough: { textDecorationLine: 'line-through', color: DarkColors.textSecondary },
  paragraph:     { marginTop: 0, marginBottom: Spacing.px8, paddingHorizontal: 0 },
  link:          { color: DarkColors.online, textDecorationLine: 'underline' },

  h1: { ...heading, fontSize: 20, marginBottom: Spacing.px4 },
  h2: { ...heading, fontSize: 18, marginBottom: Spacing.px4 },
  h3: { ...heading, fontSize: 16, marginBottom: Spacing.px2 },
  h4: { ...heading, fontSize: 15, marginBottom: Spacing.px2 },
  h5: { ...heading, fontSize: 14, marginBottom: Spacing.px2 },
  h6: { ...heading, fontSize: 13, marginBottom: Spacing.px2 },

  // `inline code`
  codespan: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoSmall,
    color: DarkColors.online,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // ```fenced blocks``` — the important one for a coding agent.
  code: {
    backgroundColor: DarkColors.bg,
    borderWidth: 1,
    borderColor: DarkColors.border,
    borderRadius: Radius.sm,
    padding: Spacing.px12,
    marginBottom: Spacing.px8,
  },

  list:       { marginBottom: Spacing.px8 },
  li:         { color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, fontSize: FontSize.body, lineHeight: 22 },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: DarkColors.borderMid,
    paddingLeft: Spacing.px12,
    marginBottom: Spacing.px8,
  },
  hr: { backgroundColor: DarkColors.border, height: 1, marginVertical: Spacing.px8 },

  table:     { borderWidth: 1, borderColor: DarkColors.border, borderRadius: Radius.xs, marginBottom: Spacing.px8 },
  tableRow:  { borderBottomWidth: 1, borderBottomColor: DarkColors.border, flexDirection: 'row' },
  tableCell: { padding: Spacing.px8 },
}

const styles = StyleSheet.create({
  // The library's blocks carry their own bottom margin; trim the trailing one so rows don't
  // gain extra space on top of the feed's row spacing.
  wrap: { marginBottom: -Spacing.px8 },
})
