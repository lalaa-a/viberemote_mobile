import React from 'react'
import {
  View, Text, FlatList, StyleSheet, RefreshControl, StatusBar,
} from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { useHistory } from '../../hooks/useRequests'
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/colors'
import type { PendingRequest } from '../../types'

const STATUS_CONFIG = {
  approved:    { color: Colors.success,      label: 'Approved', icon: '✓' },
  denied:      { color: Colors.danger,       label: 'Denied',   icon: '✕' },
  timeout:     { color: Colors.warning,      label: 'Timeout',  icon: '◷' },
  cli_pending: { color: Colors.textTertiary, label: 'CLI',      icon: '»' },
  pending:     { color: Colors.info,         label: 'Pending',  icon: '…' },
}

function HistoryRow({ item }: { item: PendingRequest }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.pending
  const timeAgo = formatDistanceToNow(
    new Date(item.decided_at ?? item.created_at),
    { addSuffix: true }
  )

  return (
    <View style={styles.row}>
      <View style={[styles.iconBox, { backgroundColor: cfg.color + '20' }]}>
        <Text style={[styles.icon, { color: cfg.color }]}>{cfg.icon}</Text>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTool}>{item.tool_name}</Text>
          <Text style={[styles.rowStatus, { color: cfg.color }]}>
            {cfg.label}
            {item.decided_by ? ` · ${item.decided_by}` : ''}
          </Text>
        </View>
        <Text style={styles.rowSummary} numberOfLines={1}>
          {item.summary}
        </Text>
        <View style={styles.rowBottom}>
          <Text style={styles.rowMachine}>
            {item.machines?.label ?? 'Unknown machine'}
          </Text>
          <Text style={styles.rowTime}>{timeAgo}</Text>
        </View>
      </View>
    </View>
  )
}

export function HistoryScreen() {
  const { data: history = [], isRefetching, refetch } = useHistory()

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgPrimary} />

      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>{history.length} decisions</Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <HistoryRow item={item} />}
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
            <Text style={styles.emptyTitle}>No history yet</Text>
            <Text style={styles.emptySub}>
              Decided requests will appear here.
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
    padding:           Spacing.lg,
    backgroundColor:   Colors.bgPrimary,
    borderBottomWidth: 0.5,
    borderColor:       Colors.border,
  },
  title: {
    fontSize:   FontSize.xl,
    fontWeight: '700',
    color:      Colors.textPrimary,
  },
  subtitle: {
    fontSize:  FontSize.sm,
    color:     Colors.textSecondary,
    marginTop: 3,
  },
  listContent: {
    padding:    Spacing.lg,
    gap:        Spacing.xs,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.md,
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.lg,
    padding:         Spacing.md,
    borderWidth:     0.5,
    borderColor:     Colors.border,
    ...Shadow.card,
  },
  iconBox: {
    width:          36,
    height:         36,
    borderRadius:   Radius.md,
    alignItems:     'center',
    justifyContent: 'center',
    flexShrink:     0,
  },
  icon: {
    fontSize:   FontSize.md,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    gap:  3,
  },
  rowTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  rowTool: {
    fontSize:   FontSize.sm,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  rowStatus: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
  },
  rowSummary: {
    fontSize:  FontSize.xs,
    color:     Colors.textSecondary,
    lineHeight:18,
  },
  rowBottom: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  rowMachine: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  rowTime: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  empty: {
    alignItems:       'center',
    paddingHorizontal: Spacing.xxxl,
    paddingTop:        Spacing.xxxl,
    gap:              Spacing.sm,
  },
  emptyTitle: {
    fontSize:   FontSize.lg,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  emptySub: {
    fontSize:  FontSize.sm,
    color:     Colors.textSecondary,
    textAlign: 'center',
  },
})
