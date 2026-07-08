import React from 'react'
import {
  View, Text, FlatList, StyleSheet, TextInput,
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
import { HarnessAvatar } from '../../components/HarnessAvatar'
import { DarkColors, DarkStatusColor, Spacing, Radius, FontSize, FontFamily, TAB_BOTTOM_INSET } from '../../constants/colors'
import type { SessionsStackParamList, AgentSession, HarnessId } from '../../types'

function dirName(cwd: string | null): string {
  if (!cwd) return '~'
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
}

type Nav = NativeStackNavigationProp<SessionsStackParamList>

function getStatusColor(session: AgentSession): string {
  if (session.cli_alive === false && session.status !== 'active') {
    return 'rgba(255,255,255,0.20)'
  }
  return DarkStatusColor[session.status] ?? DarkColors.statusFinished
}

function getStatusLabel(session: AgentSession): string {
  if (session.cli_alive === false && session.status !== 'active') return 'Closed'
  if (session.status === 'active')   return 'Active'
  if (session.status === 'idle')     return 'Idle'
  return 'Finished'
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
      style={chipStyles.scroll}
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
            <View style={[chipStyles.dot, { backgroundColor: m.is_online ? DarkColors.statusActive : DarkColors.statusFinished }]} />
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
  const dotColor   = getStatusColor(session)
  const statusLabel = getStatusLabel(session)
  const isActive   = session.status === 'active'
  const hasPending = session.pending_count > 0
  const dir        = dirName(session.cwd)
  const timeAgo    = session.last_activity_at
    ? formatDistanceToNow(new Date(session.last_activity_at), { addSuffix: true })
    : ''

  return (
    <TouchableOpacity style={styles.card} onPress={onOpen} activeOpacity={0.75}>
      <HarnessAvatar
        harness={(session.harness ?? 'claude-code') as HarnessId}
        dir={dir}
        statusColor={dotColor}
        isActive={isActive}
      />

      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>{dir}</Text>
          <Text style={styles.timeText}>{timeAgo}</Text>
        </View>

        <View style={styles.cardBottomRow}>
          <View style={styles.cardMeta}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusLabel, { color: dotColor }]}>{statusLabel}</Text>
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
  const [query, setQuery] = React.useState('')

  const { data: sessions = [], isLoading, refetch, isRefetching } = useSessions()

  // Push the list off the poll: subscribe to Realtime for the machines we can see.
  const machineIds = React.useMemo(
    () => Array.from(new Set(sessions.map(s => s.machine_id))),
    [sessions],
  )
  useSessionsRealtime(machineIds)

  const q = query.trim().toLowerCase()
  const filtered = sessions.filter(s => {
    if (selectedMachineId && s.machine_id !== selectedMachineId) return false
    if (!q) return true
    return (
      dirName(s.cwd).toLowerCase().includes(q) ||
      (s.machine_label ?? '').toLowerCase().includes(q)
    )
  })

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
    <GradientBackground style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.appName}>vibeRemote</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={DarkColors.textTertiary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search Conversations"
          placeholderTextColor={DarkColors.textTertiary}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={DarkColors.textTertiary} />
          </TouchableOpacity>
        )}
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
            tintColor={DarkColors.textSecondary}
            colors={[DarkColors.statusActive]}
          />
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="flash-outline" size={48} color={DarkColors.textSecondary} />
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
  // flexGrow:0 stops the horizontal scroll from stretching/squishing in the column
  scroll: { flexGrow: 0, marginBottom: Spacing.px12 },
  wrap: { paddingHorizontal: Spacing.px20, paddingVertical: Spacing.px4, gap: Spacing.px8, flexDirection: 'row', alignItems: 'center' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px6, height: 34,
    paddingHorizontal: Spacing.px12,
    borderRadius: Radius.full, backgroundColor: DarkColors.surface,
    borderWidth: 1, borderColor: DarkColors.border,
  },
  chipActive:     { backgroundColor: DarkColors.surfaceRaised, borderColor: DarkColors.borderMid },
  chipText:       { fontSize: FontSize.label, color: DarkColors.textSecondary, fontWeight: '500', fontFamily: FontFamily.googleSans },
  chipTextActive: { color: DarkColors.textPrimary, fontWeight: '600' },
  dot:            { width: 6, height: 6, borderRadius: Radius.full },
})

const styles = StyleSheet.create({
  root: { backgroundColor: DarkColors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px12,
  },
  appName: { fontSize: 28, fontFamily: FontFamily.bitcount, color: DarkColors.textPrimary, lineHeight: 34 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px10,
    marginHorizontal: Spacing.px20, marginBottom: Spacing.px12,
    height: 44, paddingHorizontal: Spacing.px16,
    borderRadius: Radius.full, backgroundColor: DarkColors.surface,
    borderWidth: 1, borderColor: DarkColors.borderMid,
  },
  searchInput: {
    flex: 1, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans,
    fontSize: FontSize.body, padding: 0,
  },
  listContent: { paddingBottom: TAB_BOTTOM_INSET },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px12,
    paddingVertical: Spacing.px12, paddingHorizontal: Spacing.px20,
    backgroundColor: 'transparent', borderBottomWidth: 1, borderBottomColor: DarkColors.border,
  },
  cardBody: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.px8 },
  cardTitle: { fontSize: FontSize.body, fontWeight: '600', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, flex: 1 },
  timeText:  { fontSize: FontSize.metadata, color: DarkColors.textTertiary, fontFamily: FontFamily.googleSans, flexShrink: 0 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.px8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  statusDot: { width: 6, height: 6, borderRadius: Radius.full },
  statusLabel: { fontSize: FontSize.metadata, fontWeight: '500', fontFamily: FontFamily.googleSans },
  metaSep:     { fontSize: FontSize.metadata, color: DarkColors.textTertiary },
  machineText: { fontSize: FontSize.metadata, color: DarkColors.textTertiary, fontFamily: FontFamily.googleSans, flex: 1 },
  badge: {
    backgroundColor: DarkColors.badgeBg, borderRadius: Radius.full, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, flexShrink: 0,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: DarkColors.badgeText, fontFamily: FontFamily.googleSans },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty:    { alignItems: 'center', paddingHorizontal: Spacing.px32, gap: Spacing.px12 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: Radius.full, backgroundColor: DarkColors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.px8 },
  emptyTitle: { fontSize: FontSize.displayM, fontWeight: '600', fontFamily: FontFamily.googleSans, color: DarkColors.textPrimary, textAlign: 'center', letterSpacing: -0.4, lineHeight: FontSize.displayM * 1.1 },
  emptySub:   { fontSize: FontSize.body, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
})
