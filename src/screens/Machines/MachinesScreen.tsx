import React from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, StatusBar,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { fetchMachines } from '../../api/machines'
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/colors'
import type { Machine } from '../../types'

function MachineCard({ machine }: { machine: Machine }) {
  const lastSeen = machine.last_seen
    ? formatDistanceToNow(new Date(machine.last_seen), { addSuffix: true })
    : 'Never'

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <View style={[
          styles.statusDot,
          { backgroundColor: machine.is_online ? Colors.success : Colors.textTertiary }
        ]} />
        <View style={styles.cardInfo}>
          <Text style={styles.machineLabel}>{machine.label}</Text>
          <Text style={styles.machineId} numberOfLines={1}>
            {machine.id}
          </Text>
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[
          styles.statusBadge,
          {
            backgroundColor: machine.is_online
              ? Colors.risk.low.bg
              : Colors.bgTertiary,
          },
        ]}>
          <Text style={[
            styles.statusText,
            { color: machine.is_online ? Colors.risk.low.text : Colors.textTertiary },
          ]}>
            {machine.is_online ? 'Online' : 'Offline'}
          </Text>
        </View>
        <Text style={styles.lastSeen}>{lastSeen}</Text>
      </View>
    </View>
  )
}

export function MachinesScreen() {
  const { data: machines = [], isRefetching, refetch } = useQuery({
    queryKey:        ['machines'],
    queryFn:         fetchMachines,
    refetchInterval: 30_000,    // re-fetch every 30s to match heartbeat
  })

  const online  = machines.filter(m => m.is_online).length
  const offline = machines.length - online

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgPrimary} />

      <View style={styles.header}>
        <Text style={styles.title}>Machines</Text>
        <Text style={styles.subtitle}>
          {online} online · {offline} offline
        </Text>
      </View>

      <FlatList
        data={machines}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MachineCard machine={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No machines registered</Text>
            <Text style={styles.emptySub}>
              Run{' '}
              <Text style={styles.code}>node scripts/setup.js</Text>
              {' '}on each machine you want to control.
            </Text>
          </View>
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
    padding:         Spacing.lg,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: 0.5,
    borderColor:     Colors.border,
  },
  title: {
    fontSize:   FontSize.xl,
    fontWeight: '700',
    color:      Colors.textPrimary,
  },
  subtitle: {
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    marginTop:  3,
  },
  listContent: {
    padding:     Spacing.lg,
    gap:         Spacing.sm,
  },
  card: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.lg,
    padding:         Spacing.lg,
    borderWidth:     0.5,
    borderColor:     Colors.border,
    ...Shadow.card,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.md,
    flex:          1,
  },
  statusDot: {
    width:        10,
    height:       10,
    borderRadius: Radius.full,
    flexShrink:   0,
  },
  cardInfo: {
    gap: 3,
    flex: 1,
  },
  machineLabel: {
    fontSize:   FontSize.md,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  machineId: {
    fontFamily: 'monospace',
    fontSize:   FontSize.xs,
    color:      Colors.textTertiary,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap:        4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
  },
  statusText: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
  },
  lastSeen: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  empty: {
    alignItems:       'center',
    paddingHorizontal: Spacing.xxxl,
    paddingTop:        Spacing.xxxl,
    gap:              Spacing.md,
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
})
