import React from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet
} from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { Colors, Spacing, Radius, FontSize, Shadow } from '../constants/colors'
import { RiskBadge } from './RiskBadge'
import type { PendingRequest } from '../types'

interface Props {
  request: PendingRequest
  onPress: () => void
}

// Dot color per tool type
const TOOL_DOT: Record<string, string> = {
  Bash:      '#378ADD',
  Write:     '#639922',
  Edit:      '#534AB7',
  MultiEdit: '#BA7517',
}

export function RequestCard({ request, onPress }: Props) {
  const dotColor = TOOL_DOT[request.tool_name] ?? Colors.textTertiary
  const timeAgo  = formatDistanceToNow(
    new Date(request.created_at),
    { addSuffix: true }
  )

  const isCliPending = request.status === 'cli_pending'

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left accent bar by risk */}
      <View style={[
        styles.accent,
        { backgroundColor: Colors.risk[request.risk_level]?.border ?? Colors.border }
      ]} />

      <View style={styles.body}>
        {/* Top row */}
        <View style={styles.topRow}>
          <View style={styles.toolRow}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.toolName}>{request.tool_name}</Text>
            {isCliPending && (
              <View style={styles.cliTag}>
                <Text style={styles.cliTagText}>CLI</Text>
              </View>
            )}
          </View>
          <RiskBadge level={request.risk_level} />
        </View>

        {/* Summary */}
        <Text style={styles.summary} numberOfLines={2}>
          {request.summary}
        </Text>

        {/* Files list (up to 2) */}
        {request.files_affected?.length > 0 && (
          <View style={styles.filesRow}>
            {request.files_affected.slice(0, 2).map((f, i) => (
              <Text key={i} style={styles.file} numberOfLines={1}>
                {f.split('/').pop()}
              </Text>
            ))}
            {request.files_affected.length > 2 && (
              <Text style={styles.moreFiles}>
                +{request.files_affected.length - 2} more
              </Text>
            )}
          </View>
        )}

        {/* Bottom row */}
        <View style={styles.bottomRow}>
          <Text style={styles.machine}>
            {request.machines?.label ?? 'Unknown machine'}
          </Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>

      {/* Arrow */}
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection:   'row',
    backgroundColor: Colors.cardBg,
    marginHorizontal: Spacing.lg,
    marginVertical:   Spacing.xs,
    borderRadius:    Radius.lg,
    borderWidth:     0.5,
    borderColor:     Colors.border,
    overflow:        'hidden',
    ...Shadow.card,
  },
  accent: {
    width:           4,
    alignSelf:       'stretch',
  },
  body: {
    flex:    1,
    padding: Spacing.md,
    gap:     Spacing.xs,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  toolRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: Radius.full,
  },
  toolName: {
    fontSize:   FontSize.sm,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  cliTag: {
    backgroundColor: Colors.bgTertiary,
    paddingHorizontal: 5,
    paddingVertical:   1,
    borderRadius:    Radius.sm,
  },
  cliTagText: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
    fontWeight:'600',
  },
  summary: {
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    lineHeight: 18,
  },
  filesRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
  },
  file: {
    fontSize:        FontSize.xs,
    fontFamily:      'monospace',
    color:           Colors.primary,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:    Radius.sm,
    maxWidth:        160,
  },
  moreFiles: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
    alignSelf: 'center',
  },
  bottomRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    marginTop:      Spacing.xs,
  },
  machine: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  time: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  arrow: {
    fontSize:   22,
    color:      Colors.border,
    alignSelf:  'center',
    paddingRight: Spacing.sm,
  },
})
