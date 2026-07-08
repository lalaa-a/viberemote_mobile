import React from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, StatusBar, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import { formatDistanceToNow } from 'date-fns'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { fetchMachines, fetchHarnessState, unpairMachine } from '../../api/server'
import { useMachineChannel } from '../../hooks/useMachineChannel'
import { GradientBackground } from '../../components/GradientBackground'
import { DarkColors, Spacing, Radius, FontSize, FontFamily, TAB_BOTTOM_INSET } from '../../constants/colors'
import type { Machine, HarnessId } from '../../types'

// Harness → icon glyph (swap for SVG logos later)
const HARNESS_ICON: Record<string, string> = {
  'claude-code': 'cube-outline',
  'opencode':    'document-outline',
  'gemini-cli':  'terminal-outline',
}

// ── Harness bubble ────────────────────────────────────────────────────────────
// Green when the harness is mobile-enabled (toggled ON from the desktop),
// otherwise the "third" surface color. Display-only — toggling happens on desktop.
function HarnessBubble({ harness, enabled }: { harness: HarnessId; enabled: boolean }) {
  const icon = HARNESS_ICON[harness] ?? 'cube-outline'
  return (
    <View style={[bStyles.bubble, { backgroundColor: enabled ? DarkColors.online : DarkColors.surfaceRaised }]}>
      <Ionicons name={icon} size={20} color={enabled ? DarkColors.bg : DarkColors.textPrimary} />
    </View>
  )
}

// ── Available harness support ─────────────────────────────────────────────────
function HarnessSupport({ machineId, isOnline }: { machineId: string; isOnline: boolean }) {
  const { data: harnesses = [], isLoading } = useQuery({
    queryKey:        ['harnesses', machineId],
    queryFn:         () => fetchHarnessState(machineId),
    refetchInterval: 30_000,
    enabled:         isOnline,
  })

  const installed = harnesses.filter(h => h.installed)
  if (isLoading) {
    return <ActivityIndicator size="small" color={DarkColors.textTertiary} style={{ alignSelf: 'flex-start' }} />
  }
  if (installed.length === 0) return null

  return (
    <View style={bStyles.harnessRow}>
      {installed.map(h => (
        <HarnessBubble key={h.harness} harness={h.harness} enabled={h.mobile_enabled} />
      ))}
    </View>
  )
}

// ── Machine card ──────────────────────────────────────────────────────────────
function MachineCard({ machine }: { machine: Machine }) {
  const queryClient = useQueryClient()

  // Instant refresh when this machine's harness state changes on the desktop.
  useMachineChannel(machine.id)

  const disconnectMut = useMutation({
    mutationFn: () => unpairMachine(machine.id),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['machines'] }),
    onError:    (e: any) => Alert.alert('Error', e.message),
  })

  function handleDisconnect() {
    Alert.alert('Unpair machine?', 'The machine QR will reappear so a phone can connect again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unpair', style: 'destructive', onPress: () => disconnectMut.mutate() },
    ])
  }

  const lastSeen = machine.last_seen
    ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true })
    : 'Never'
  const isOnline   = machine.is_online
  const connection = machine.connection ?? 'none'
  const pairedAgo  = machine.paired_at
    ? formatDistanceToNow(new Date(machine.paired_at))
    : null

  return (
    <View style={styles.card}>
      {/* Name + online status — inside the raised strip */}
      <View style={styles.strip}>
        <View style={styles.nameRow}>
          <Ionicons name="desktop-outline" size={20} color={DarkColors.textPrimary} />
          <Text style={styles.machineLabel} numberOfLines={1}>{machine.label}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: isOnline ? DarkColors.online : DarkColors.surface }]}>
          <Text style={[styles.statusText, { color: isOnline ? DarkColors.bg : DarkColors.textSecondary }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Last seen + pairing — inset from the card edge */}
      <View style={styles.infoBlock}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={DarkColors.textSecondary} />
          <Text style={styles.infoText}>Last seen {lastSeen}</Text>
        </View>

        {connection !== 'none' && (
          <View style={styles.infoRow}>
            <Ionicons name="phone-portrait-outline" size={16} color={DarkColors.textSecondary} />
            <Text style={styles.infoText}>
              {connection === 'this'
                ? `Connected to this phone${pairedAgo ? ' · ' + pairedAgo : ''}`
                : 'Connected to another phone'}
            </Text>
          </View>
        )}
      </View>

      {/* Available harness support */}
      <Text style={styles.sectionTitle}>Available Harness Support</Text>
      <View style={styles.harnessBottomRow}>
        <HarnessSupport machineId={machine.id} isOnline={isOnline} />
        {connection === 'this' && (
          <TouchableOpacity
            style={styles.unpairBtn}
            onPress={handleDisconnect}
            disabled={disconnectMut.isPending}
            activeOpacity={0.75}
          >
            {disconnectMut.isPending
              ? <ActivityIndicator size="small" color={DarkColors.bg} />
              : <Text style={styles.unpairText}>unpair</Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export function MachinesScreen() {
  const navigation  = useNavigation()
  const insets      = useSafeAreaInsets()
  const { data: machines = [], isRefetching, refetch } = useQuery({
    queryKey:        ['machines'],
    queryFn:         fetchMachines,
    refetchInterval: 30_000,
  })

  function handleScanQR() {
    navigation.navigate('QRScan' as never)
  }

  return (
    <GradientBackground style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.appName}>machines</Text>
        <TouchableOpacity onPress={handleScanQR} style={styles.scanBtn} activeOpacity={0.75}>
          <Ionicons name="qr-code-outline" size={18} color={DarkColors.textPrimary} />
          <Text style={styles.scanBtnText}>Connect</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={machines}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MachineCard machine={item} />}
        contentContainerStyle={
          machines.length === 0 ? styles.emptyContainer : styles.listContent
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={DarkColors.textSecondary}
            colors={[DarkColors.online]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="desktop-outline" size={48} color={DarkColors.textSecondary} />
            </View>
            <Text style={styles.emptyTitle}>{'No machines\nconnected yet.'}</Text>
            <Text style={styles.emptySub}>
              Tap <Text style={styles.code}>Connect</Text> above to scan the QR on a machine dashboard.
            </Text>
          </View>
        }
      />
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  root: { backgroundColor: DarkColors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px16,
  },
  appName: { fontSize: 28, fontFamily: FontFamily.bitcount, color: DarkColors.textPrimary, lineHeight: 34 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px8,
    paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px10,
    borderRadius: Radius.full, backgroundColor: DarkColors.surfaceRaised,
  },
  scanBtnText: { fontSize: FontSize.label, color: DarkColors.textPrimary, fontWeight: '600', fontFamily: FontFamily.googleSans },
  listContent: { paddingHorizontal: Spacing.px20, paddingTop: Spacing.px4, paddingBottom: TAB_BOTTOM_INSET, gap: Spacing.px12 },
  card: {
    backgroundColor: DarkColors.surface, borderRadius: Radius.lg,
    padding: Spacing.px12, gap: Spacing.px10,
  },
  // Raised strip holding machine icon + name + online pill
  strip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.px8,
    backgroundColor: DarkColors.surfaceRaised, borderRadius: Radius.md,
    paddingHorizontal: Spacing.px12, paddingVertical: Spacing.px10,
  },
  nameRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, flex: 1 },
  machineLabel: { fontSize: FontSize.cardTitle, fontFamily: FontFamily.googleSans, fontWeight: '600', color: DarkColors.textPrimary, flex: 1 },
  statusPill: { paddingHorizontal: Spacing.px12, paddingVertical: 5, borderRadius: Radius.full, flexShrink: 0 },
  statusText: { fontSize: FontSize.label, fontWeight: '700', fontFamily: FontFamily.googleSans },
  // Inset the detail rows from the card edge
  infoBlock: { paddingHorizontal: Spacing.px8, gap: Spacing.px8 },
  infoRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8 },
  infoText: { fontSize: FontSize.metadata, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans },
  sectionTitle: { fontSize: FontSize.label, fontWeight: '700', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, marginTop: Spacing.px4, paddingHorizontal: Spacing.px8 },
  harnessBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.px8, paddingHorizontal: Spacing.px8 },
  unpairBtn: {
    paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px8,
    borderRadius: Radius.full, backgroundColor: DarkColors.unpair, flexShrink: 0,
  },
  unpairText: { fontSize: FontSize.label, fontWeight: '700', color: DarkColors.bg, fontFamily: FontFamily.googleSans },
  emptyContainer:  { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty:           { alignItems: 'center', paddingHorizontal: Spacing.px32, gap: Spacing.px12 },
  emptyIconWrap:   { width: 80, height: 80, borderRadius: Radius.full, backgroundColor: DarkColors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.px8 },
  emptyTitle:      { fontSize: FontSize.displayM, fontWeight: '600', fontFamily: FontFamily.googleSans, color: DarkColors.textPrimary, textAlign: 'center', letterSpacing: -0.4, lineHeight: FontSize.displayM * 1.1 },
  emptySub:        { fontSize: FontSize.body, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans, textAlign: 'center', lineHeight: 22 },
  code:            { fontSize: FontSize.monoSmall, color: DarkColors.online, fontFamily: FontFamily.mono },
})

const bStyles = StyleSheet.create({
  harnessRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8 },
  bubble: {
    width: 40, height: 40, borderRadius: Radius.full,
    alignItems: 'center', justifyContent: 'center',
  },
})
