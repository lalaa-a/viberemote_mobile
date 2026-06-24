import React from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TouchableOpacity, StatusBar, ScrollView,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSessions } from '../../hooks/useSessions'
import { useSessionsRealtime } from '../../hooks/useSessionsRealtime'
import { fetchMachines } from '../../api/server'
import { useAppStore } from '../../store/useAppStore'
import { GradientBackground } from '../../components/GradientBackground'
import { LiveBadge } from '../../components/LiveBadge'
import { HarnessBadge } from '../../components/HarnessBadge'
import { Colors, Spacing, Radius, FontSize, FontFamily, Shadow, TAB_BOTTOM_INSET } from '../../constants/colors'
import type { SessionsStackParamList, AgentSession, HarnessId } from '../../types'

function dirName(cwd: string | null): string {
  if (!cwd) return '~'
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
}

type Nav = NativeStackNavigationProp<SessionsStackParamList>

const STATUS_COLOR: Record<string, string> = {
  active:   Colors.success,
  idle:     Colors.warning,
  finished: Colors.textTertiary,
}

// ── Machine filter chips ──────────────────────────────────────────────────────
function MachineChips() {
  const selectedMachineId    = useAppStore(s => s.selectedMachineId)
  const setSelectedMachineId = useAppStore(s => s.setSelectedMachineId)

  const { data: machines = [] } = useQuery({
    queryKey:        ['machines'],
    queryFn:         fetchMachines,
    refetchInterval: 60_000,
  })

  if (machines.length === 0) return null

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipStyles.wrap}
    >
      <TouchableOpacity
        style={[chipStyles.chip, !selectedMachineId && chipStyles.chipActive]}
        onPress={() => setSelectedMachineId(null)}
        activeOpacity={0.75}
      >
        <Text style={[chipStyles.chipText, !selectedMachineId && chipStyles.chipTextActive]}>
          All
        </Text>
      </TouchableOpacity>
      {machines.map(m => {
        const active = selectedMachineId === m.id
        return (
          <TouchableOpacity
            key={m.id}
            style={[chipStyles.chip, active && chipStyles.chipActive]}
            onPress={() => setSelectedMachineId(active ? null : m.id)}
            activeOpacity={0.75}
          >
            <View style={[chipStyles.dot, { backgroundColor: m.is_online ? Colors.success : Colors.borderHairline }]} />
            <Text style={[chipStyles.chipText, active && chipStyles.chipTextActive]} numberOfLines={1}>
              {m.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </ScrollView>
  )
}

// ── Chat card ─────────────────────────────────────────────────────────────────
function SessionCard({ session, onOpen }: { session: AgentSession; onOpen: () => void }) {
  const cliClosed  = session.cli_alive === false && session.status !== 'active'
  const dotColor   = cliClosed ? Colors.textTertiary : (STATUS_COLOR[session.status] ?? Colors.textTertiary)
  const isActive   = session.status === 'active'
  const hasPending = session.pending_count > 0
  const dir        = dirName(session.cwd)
  const timeAgo    = session.last_activity_at
    ? formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })
    : ''

  return (
    <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.75}>
      <View style={[styles.avatar, { borderColor: dotColor + '60' }]}>
        <Text style={styles.avatarText}>{dir.charAt(0).toUpperCase()}</Text>
        {isActive && <View style={[styles.avatarDot, { backgroundColor: Colors.success }]} />}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{dir}</Text>
            <HarnessBadge harness={(session.harness ?? 'claude-code') as HarnessId} size="xs" />
          </View>
          <Text style={styles.timeText}>{timeAgo}</Text>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.cardMeta}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusLabel, { color: dotColor }]}>
              {cliClosed ? 'Closed' : isActive ? 'Active' : session.status === 'idle' ? 'Idle' : 'Finished'}
            </Text>
            <Text style={styles.metaSep}>·</Text>
            <Text style={styles.machineText} numberOfLines={1}>{session.machine_label}</Text>
          </View>
          {hasPending && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{session.pending_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function SessionsScreen() {
  const navigation = useNavigation<Nav>()
  const insets     = useSafeAreaInsets()
  const selectedMachineId = useAppStore(s => s.selectedMachineId)

  const { data: sessions = [], isLoading, refetch, isRefetching } = useSessions()

  // Push the list off the poll: subscribe to Realtime for the machines we can see.
  const machineIds = React.useMemo(
    () => Array.from(new Set(sessions.map(s => s.machine_id))),
    [sessions],
  )
  useSessionsRealtime(machineIds)

  const filtered = selectedMachineId
    ? sessions.filter(s => s.machine_id === selectedMachineId)
    : sessions

  function renderItem({ item }: { item: AgentSession }) {
    return (
      <SessionCard
        session={item}
        onOpen={() => navigation.navigate('Chat', {
          sessionId:       item.session_id,
          machineLabel:    item.machine_label,
          cwd:             item.cwd,
          machineIsOnline: item.machine_is_online,
          harness:         (item.harness ?? 'claude-code') as any,
          status:          item.status,
        })}
      />
    )
  }

  return (
    <GradientBackground>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.appName}>Vibe Remote</Text>
          <Text style={styles.title}>Chats</Text>
        </View>
        <LiveBadge />
      </View>

      <MachineChips />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="flash-outline" size={48} color={Colors.accentDeep} />
              </View>
              <Text style={styles.emptyTitle}>{'No sessions\nrunning.'}</Text>
              <Text style={styles.emptySub}>
                Sessions appear once an agent intercepts a tool call.
                Enable mobile support from the desktop app.
              </Text>
            </View>
          )
        }
      />
    </GradientBackground>
  )
}

const chipStyles = StyleSheet.create({
  wrap: { paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px8, gap: Spacing.px8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px6,
    paddingHorizontal: Spacing.px12, paddingVertical: Spacing.px6,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceGlassStrong,
    borderWidth: 1, borderColor: Colors.borderHairline,
  },
  chipActive:     { backgroundColor: Colors.accentLight, borderColor: Colors.accent + '80' },
  chipText:       { fontSize: FontSize.label, color: Colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: Colors.accentDeep, fontWeight: '600' },
  dot:            { width: 6, height: 6, borderRadius: Radius.full },
})

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px12,
  },
  appName: { fontSize: 28, fontFamily: FontFamily.serifItalic, color: Colors.textPrimary, lineHeight: 32 },
  title:   { fontSize: FontSize.cardTitle, fontFamily: FontFamily.loraItalic, fontWeight: '500', color: Colors.textTertiary, letterSpacing: 0.3 },
  listContent: { paddingBottom: TAB_BOTTOM_INSET },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px12,
    paddingVertical: Spacing.px12, paddingHorizontal: Spacing.px20,
    backgroundColor: Colors.bgPrimary, borderBottomWidth: 1, borderBottomColor: Colors.borderHairline,
  },
  avatar: {
    width: 48, height: 48, borderRadius: Radius.full, backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, flexShrink: 0, position: 'relative',
  },
  avatarText: { fontSize: FontSize.cardTitle, fontWeight: '700', color: Colors.accentDeep, fontFamily: FontFamily.serifBold },
  avatarDot: {
    position: 'absolute', bottom: 1, right: 1, width: 12, height: 12,
    borderRadius: Radius.full, borderWidth: 2, borderColor: Colors.bgPrimary,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.px8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, flex: 1 },
  cardTitle: { fontSize: FontSize.cardTitle, fontWeight: '600', color: Colors.textPrimary, flexShrink: 1 },
  timeText:  { fontSize: FontSize.metadata, color: Colors.textTertiary, flexShrink: 0 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.px8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  statusDot: { width: 6, height: 6, borderRadius: Radius.full },
  statusLabel: { fontSize: FontSize.metadata, fontWeight: '500' },
  metaSep:     { fontSize: FontSize.metadata, color: Colors.textTertiary },
  machineText: { fontSize: FontSize.metadata, color: Colors.textTertiary, flex: 1 },
  badge: {
    backgroundColor: Colors.danger, borderRadius: Radius.full, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, flexShrink: 0,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: Colors.white },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty:    { alignItems: 'center', paddingHorizontal: Spacing.px32, gap: Spacing.px12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: Radius.full, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.px8 },
  emptyTitle: { fontSize: FontSize.displayM, fontWeight: '500', fontFamily: 'Fraunces-SemiBold', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -0.4, lineHeight: FontSize.displayM * 1.1 },
  emptySub:   { fontSize: FontSize.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
})
