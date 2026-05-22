import React from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TouchableOpacity, StatusBar,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { formatDistanceToNow } from 'date-fns'
import { useSessions } from '../../hooks/useSessions'
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/colors'
import type { SessionsStackParamList, AgentSession } from '../../types'

type Nav = NativeStackNavigationProp<SessionsStackParamList>

const STATUS_DOT: Record<string, string> = {
  active:   Colors.success,
  idle:     Colors.warning,
  finished: Colors.textTertiary,
}

const STATUS_LABEL: Record<string, string> = {
  active:   'Active',
  idle:     'Idle',
  finished: 'Finished',
}

function SessionCard({ session, onDetail, onPrompt }: {
  session:  AgentSession
  onDetail: () => void
  onPrompt: () => void
}) {
  const dotColor    = STATUS_DOT[session.status] ?? Colors.textTertiary
  const statusLabel = STATUS_LABEL[session.status] ?? session.status
  const lastSeen    = session.last_activity_at
    ? formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })
    : 'Never'
  const canPrompt   = session.pending_count === 0 && session.status !== 'finished'
  const cwd         = session.cwd ?? '~'

  return (
    <View style={styles.card}>
      {/* Left accent */}
      <View style={[styles.accent, { backgroundColor: dotColor }]} />

      <View style={styles.cardBody}>
        {/* Machine + status */}
        <View style={styles.topRow}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
            <Text style={styles.machineLabel} numberOfLines={1}>
              {session.machine_label}
            </Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: dotColor }]}>
            <Text style={[styles.statusText, { color: dotColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {/* CWD */}
        <Text style={styles.cwd} numberOfLines={1}>{cwd}</Text>

        {/* Pending count + last activity */}
        <Text style={styles.meta}>
          {session.pending_count > 0
            ? `${session.pending_count} pending · `
            : ''}
          {lastSeen}
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.promptBtn, !canPrompt && styles.promptBtnDisabled]}
            disabled={!canPrompt}
            onPress={onPrompt}
            activeOpacity={0.7}
          >
            <Text style={[styles.promptBtnText, !canPrompt && styles.promptBtnTextDisabled]}>
              {session.pending_count > 0 ? 'Approvals pending…' : 'Prompt'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.detailBtn} onPress={onDetail} activeOpacity={0.7}>
            <Text style={styles.detailBtnText}>Detail →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

export function SessionsScreen() {
  const navigation = useNavigation<Nav>()
  const { data: sessions = [], isLoading, refetch, isRefetching } = useSessions()

  const activeCount = sessions.filter(s => s.status === 'active').length

  function renderItem({ item }: { item: AgentSession }) {
    return (
      <SessionCard
        session={item}
        onDetail={() => navigation.navigate('SessionDetail', {
          sessionId:       item.session_id,
          machineLabel:    item.machine_label,
          cwd:             item.cwd,
          machineIsOnline: item.machine_is_online,
        })}
        onPrompt={() => navigation.navigate('PromptCompose', {
          sessionId: item.session_id,
        })}
      />
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgPrimary} />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Sessions</Text>
          {activeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeCount} active</Text>
            </View>
          )}
        </View>
        <Text style={styles.liveIndicator}>↻ 10s</Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          sessions.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⚡</Text>
              <Text style={styles.emptyTitle}>No sessions</Text>
              <Text style={styles.emptySub}>
                Sessions appear here when{' '}
                <Text style={styles.code}>hook.js</Text>
                {' '}intercepts a tool call from Claude Code.
              </Text>
            </View>
          )
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.bgSecondary,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.lg,
    paddingBottom:     Spacing.md,
    backgroundColor:   Colors.bgPrimary,
    borderBottomWidth: 0.5,
    borderColor:       Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.sm,
  },
  title: {
    fontSize:   FontSize.xl,
    fontWeight: '700',
    color:      Colors.textPrimary,
  },
  badge: {
    backgroundColor:   Colors.primaryLight,
    borderRadius:      Radius.full,
    paddingHorizontal: 8,
    paddingVertical:   3,
  },
  badgeText: {
    color:      Colors.primary,
    fontSize:   FontSize.xs,
    fontWeight: '600',
  },
  liveIndicator: {
    fontSize:   FontSize.xs,
    color:      Colors.success,
    fontWeight: '600',
  },
  listContent: {
    padding:     Spacing.lg,
    gap:         Spacing.sm,
    paddingBottom: Spacing.xxxl,
  },
  emptyContainer: {
    flex:           1,
    justifyContent: 'center',
  },
  empty: {
    alignItems:        'center',
    paddingHorizontal: Spacing.xxxl,
    gap:               Spacing.md,
  },
  emptyIcon: {
    fontSize:    40,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize:   FontSize.lg,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  emptySub: {
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
  code: {
    fontFamily: 'monospace',
    color:      Colors.primary,
  },

  // Session card
  card: {
    flexDirection:   'row',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.lg,
    borderWidth:     0.5,
    borderColor:     Colors.border,
    overflow:        'hidden',
    ...Shadow.card,
  },
  accent: {
    width: 4,
  },
  cardBody: {
    flex:    1,
    padding: Spacing.md,
    gap:     Spacing.xs,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    flex:          1,
  },
  dot: {
    width:        8,
    height:       8,
    borderRadius: Radius.full,
    flexShrink:   0,
  },
  machineLabel: {
    fontSize:   FontSize.md,
    fontWeight: '600',
    color:      Colors.textPrimary,
    flex:       1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical:   2,
    borderRadius:      Radius.sm,
    borderWidth:       1,
  },
  statusText: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
  },
  cwd: {
    fontFamily: 'monospace',
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
  },
  meta: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  actions: {
    flexDirection: 'row',
    gap:           Spacing.sm,
    marginTop:     Spacing.xs,
  },
  promptBtn: {
    flex:              1,
    paddingVertical:   Spacing.sm,
    borderRadius:      Radius.sm,
    backgroundColor:   Colors.primary,
    alignItems:        'center',
  },
  promptBtnDisabled: {
    backgroundColor: Colors.bgTertiary,
  },
  promptBtnText: {
    fontSize:   FontSize.sm,
    fontWeight: '600',
    color:      Colors.white,
  },
  promptBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  detailBtn: {
    paddingVertical:   Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius:      Radius.sm,
    borderWidth:       0.5,
    borderColor:       Colors.border,
    alignItems:        'center',
  },
  detailBtnText: {
    fontSize:   FontSize.sm,
    fontWeight: '500',
    color:      Colors.textSecondary,
  },
})
