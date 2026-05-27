import React from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, StatusBar, TouchableOpacity, Alert,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { fetchMachines } from '../../api/machines'
import { useAuth } from '../../hooks/useAuth'
import { GradientBackground } from '../../components/GradientBackground'
import { Colors, Spacing, Radius, FontSize, FontFamily, Shadow, TAB_BOTTOM_INSET } from '../../constants/colors'
import type { Machine } from '../../types'

function MachineCard({ machine }: { machine: Machine }) {
  const lastSeen = machine.last_seen
    ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true })
    : 'Never'
  const isOnline = machine.is_online

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[
          styles.statusDot,
          { backgroundColor: isOnline ? Colors.success : Colors.borderHairline },
        ]} />
        <View style={styles.cardInfo}>
          <Text style={styles.machineLabel}>{machine.label}</Text>
          <Text style={styles.machineId} numberOfLines={1}>{machine.id}</Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[
          styles.statusPill,
          {
            backgroundColor: isOnline
              ? 'rgba(122,165,111,0.15)'
              : Colors.surfaceGlassStrong,
            borderColor: isOnline ? Colors.success + '60' : Colors.borderHairline,
          },
        ]}>
          <Text style={[
            styles.statusText,
            { color: isOnline ? Colors.successDark : Colors.textTertiary },
          ]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
        <Text style={styles.lastSeen}>{lastSeen}</Text>
      </View>
    </View>
  )
}

export function MachinesScreen() {
  const { signOut } = useAuth()
  const insets = useSafeAreaInsets()
  const { data: machines = [], isRefetching, refetch } = useQuery({
    queryKey:        ['machines'],
    queryFn:         fetchMachines,
    refetchInterval: 30_000,
  })

  const online  = machines.filter(m => m.is_online).length
  const offline = machines.length - online

  function handleDisconnect() {
    Alert.alert(
      'Disconnect',
      'Remove this machine pairing? You will need to scan the QR code again.',
      [
        { text: 'Cancel',     style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: signOut },
      ]
    )
  }

  return (
    <GradientBackground>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.appName}>Vibe Remote</Text>
          <Text style={styles.title}>Machines</Text>
        </View>
        <TouchableOpacity
          onPress={handleDisconnect}
          style={styles.disconnectBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.disconnectText}>Disconnect</Text>
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
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="server-outline" size={48} color={Colors.accentDeep} />
            </View>
            <Text style={styles.emptyTitle}>{'No machines\nregistered yet.'}</Text>
            <Text style={styles.emptySub}>
              Run{' '}
              <Text style={styles.code}>node scripts/setup.js</Text>
              {' '}on each machine.
            </Text>
          </View>
        }
      />
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: Spacing.px20,
    paddingBottom:     Spacing.px16,
  },
  appName: {
    fontSize:   28,
    fontFamily: FontFamily.serifItalic,
    color:      Colors.textPrimary,
    lineHeight: 32,
  },
  title: {
    fontSize:      FontSize.cardTitle,
    fontFamily:    FontFamily.loraItalic,
    fontWeight:    '500',
    color:         Colors.textTertiary,
    letterSpacing: 0.3,
  },
  disconnectBtn: {
    paddingHorizontal: Spacing.px12,
    paddingVertical:   Spacing.px8,
    borderRadius:      Radius.sm,
    borderWidth:       1,
    borderColor:       Colors.danger + '50',
    justifyContent:    'center',
  },
  disconnectText: {
    fontSize:  FontSize.label,
    color:     Colors.danger,
    fontWeight:'500',
  },
  listContent: {
    paddingHorizontal: Spacing.px20,
    paddingTop:        Spacing.px4,
    paddingBottom:     TAB_BOTTOM_INSET,
    gap:               Spacing.px12,
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: Colors.bgPrimary,
    borderRadius:    Radius.md,
    padding:         Spacing.px20,
    borderWidth:     1,
    borderColor:     Colors.borderHairline,
    borderTopColor:  Colors.borderGlass,
    ...Shadow.glassLow,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.px12,
    flex:          1,
  },
  statusDot: {
    width:        10,
    height:       10,
    borderRadius: Radius.full,
    flexShrink:   0,
  },
  cardInfo: { flex: 1, gap: 2 },
  machineLabel: {
    fontSize:   FontSize.label,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  machineId: {
    fontSize: FontSize.monoSmall,
    color:    Colors.textTertiary,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap:        4,
  },
  statusPill: {
    paddingHorizontal: Spacing.px8,
    paddingVertical:   3,
    borderRadius:      Radius.full,
    borderWidth:       1,
  },
  statusText: {
    fontSize:      FontSize.microLabel,
    fontWeight:    '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  lastSeen: {
    fontSize: FontSize.metadata,
    color:    Colors.textTertiary,
  },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  empty: {
    alignItems:        'center',
    paddingHorizontal: Spacing.px32,
    gap:               Spacing.px12,
  },
  emptyIconWrap: {
    width:           80,
    height:          80,
    borderRadius:    Radius.full,
    backgroundColor: Colors.accentLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Spacing.px8,
  },
  emptyTitle: {
    fontSize:      FontSize.displayM,
    fontWeight:    '500',
    fontFamily:    'Fraunces-SemiBold',
    color:         Colors.textPrimary,
    textAlign:     'center',
    letterSpacing: -0.4,
    lineHeight:    FontSize.displayM * 1.1,
  },
  emptySub: {
    fontSize:   FontSize.body,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
  },
  code: {
    fontSize: FontSize.monoSmall,
    color:    Colors.accent,
  },
})
