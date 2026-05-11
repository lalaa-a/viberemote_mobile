import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform
} from 'react-native'
import { Colors, Spacing, Radius, FontSize } from '../../constants/colors'
import type { FileDiff, DiffHunk } from '../../types'

interface Props {
  diff: FileDiff
}

// ── Single hunk line ──────────────────────────────────────────────────────────
function HunkLine({ hunk }: { hunk: DiffHunk }) {
  const cfg =
    hunk.type === 'add'    ? Colors.diffAdd    :
    hunk.type === 'remove' ? Colors.diffRemove :
                             Colors.diffContext

  const prefix = hunk.type === 'add' ? '+' : hunk.type === 'remove' ? '-' : ' '

  return (
    <View style={[styles.line, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.prefix, { color: cfg.text }]}>{prefix}</Text>
      <Text style={[styles.lineText, { color: cfg.text }]} selectable>
        {hunk.content}
      </Text>
    </View>
  )
}

// ── Single file diff ──────────────────────────────────────────────────────────
function FileDiffView({
  diff,
  showHeader = true,
}: {
  diff:       FileDiff
  showHeader?: boolean
}) {
  const [expanded, setExpanded] = useState(true)
  const stats = diff.stats ?? { added: 0, removed: 0 }

  return (
    <View style={styles.fileBlock}>
      {showHeader && (
        <TouchableOpacity
          style={styles.fileHeader}
          onPress={() => setExpanded(e => !e)}
          activeOpacity={0.7}
        >
          <View style={styles.fileHeaderLeft}>
            <Text style={styles.langDot}>
              {diff.language ?? 'txt'}
            </Text>
            <Text style={styles.fileName} numberOfLines={1}>
              {diff.file_path}
            </Text>
            {diff.is_new_file && (
              <View style={styles.newFileBadge}>
                <Text style={styles.newFileText}>NEW</Text>
              </View>
            )}
          </View>
          <View style={styles.fileHeaderRight}>
            <Text style={styles.statAdd}>+{stats.added}</Text>
            <Text style={styles.statRemove}>-{stats.removed}</Text>
            <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
          </View>
        </TouchableOpacity>
      )}

      {expanded && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.hunks}>
            {(diff.hunks ?? []).map((hunk, i) => (
              <HunkLine key={i} hunk={hunk} />
            ))}
            {(diff.hunks ?? []).length === 0 && (
              <Text style={styles.emptyHunks}>No diff available</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}

// ── Main DiffViewer ───────────────────────────────────────────────────────────
export function DiffViewer({ diff }: Props) {
  if (!diff) return null

  // multi_edit_diff contains multiple file diffs
  if (diff.type === 'multi_edit_diff' && diff.files?.length) {
    return (
      <View style={styles.container}>
        <View style={styles.grandStats}>
          <Text style={styles.grandStatsText}>
            {diff.file_count} file{diff.file_count !== 1 ? 's' : ''}
            {'  '}
            <Text style={styles.statAdd}>
              +{diff.grand_stats?.added ?? 0}
            </Text>
            {'  '}
            <Text style={styles.statRemove}>
              -{diff.grand_stats?.removed ?? 0}
            </Text>
          </Text>
        </View>
        {diff.files.map((f, i) => (
          <FileDiffView key={i} diff={f} showHeader />
        ))}
      </View>
    )
  }

  // edit_diff may have nested edits
  if (diff.type === 'edit_diff' && diff.edits?.length) {
    return (
      <View style={styles.container}>
        {diff.edits.map((e, i) => (
          <FileDiffView key={i} diff={e} showHeader={diff.edits!.length > 1} />
        ))}
      </View>
    )
  }

  // Single file diff (file_diff or edit_diff without nested edits)
  return (
    <View style={styles.container}>
      <FileDiffView diff={diff} showHeader={false} />
    </View>
  )
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

const styles = StyleSheet.create({
  container: {
    borderRadius:  Radius.md,
    borderWidth:   0.5,
    borderColor:   Colors.border,
    overflow:      'hidden',
    backgroundColor: Colors.bgSecondary,
  },
  grandStats: {
    padding:         Spacing.sm,
    backgroundColor: Colors.bgTertiary,
    borderBottomWidth: 0.5,
    borderColor:     Colors.border,
  },
  grandStatsText: {
    fontSize:   FontSize.xs,
    color:      Colors.textSecondary,
    fontWeight: '500',
  },
  fileBlock: {
    borderTopWidth: 0.5,
    borderColor:    Colors.border,
  },
  fileHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    padding:         Spacing.sm,
    backgroundColor: Colors.bgTertiary,
  },
  fileHeaderLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    flex:          1,
  },
  langDot: {
    fontSize:        FontSize.xs,
    fontFamily:      MONO,
    color:           Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderRadius:    Radius.sm,
  },
  fileName: {
    fontFamily: MONO,
    fontSize:   FontSize.xs,
    color:      Colors.textPrimary,
    flex:       1,
  },
  newFileBadge: {
    backgroundColor: Colors.risk.low.bg,
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderRadius:    Radius.sm,
  },
  newFileText: {
    fontSize:   FontSize.xs,
    color:      Colors.risk.low.text,
    fontWeight: '600',
  },
  fileHeaderRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  statAdd: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
    color:      Colors.risk.low.text,
  },
  statRemove: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
    color:      Colors.risk.critical.text,
  },
  chevron: {
    fontSize: FontSize.xs,
    color:    Colors.textTertiary,
  },
  hunks: {
    minWidth: '100%',
  },
  line: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.sm,
    paddingVertical:   2,
  },
  prefix: {
    fontFamily: MONO,
    fontSize:   FontSize.xs,
    width:      14,
    lineHeight: 18,
  },
  lineText: {
    fontFamily: MONO,
    fontSize:   FontSize.xs,
    lineHeight: 18,
    flex:       1,
  },
  emptyHunks: {
    padding:  Spacing.md,
    color:    Colors.textTertiary,
    fontSize: FontSize.xs,
  },
})
