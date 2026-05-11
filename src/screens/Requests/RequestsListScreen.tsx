import React from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TouchableOpacity, StatusBar,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { usePendingRequests } from '../../hooks/useRequests'
import { RequestCard } from '../../components/RequestCard'
import { Colors, Spacing, FontSize, Radius } from '../../constants/colors'
import type { RequestsStackParamList, PendingRequest } from '../../types'

type Nav = NativeStackNavigationProp<RequestsStackParamList>

export function RequestsListScreen() {
  const navigation = useNavigation<Nav>()
  const { data: requests = [], isLoading, refetch, isRefetching } = usePendingRequests()

  function renderItem({ item }: { item: PendingRequest }) {
    return (
      <RequestCard
        request={item}
        onPress={() => navigation.navigate('RequestDetail', { id: item.id })}
      />
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgPrimary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Requests</Text>
          {requests.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{requests.length}</Text>
            </View>
          )}
        </View>
        <Text style={styles.liveIndicator}>● Live</Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          requests.length === 0 ? styles.emptyContainer : styles.listContent
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
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>✓</Text>
              </View>
              <Text style={styles.emptyTitle}>All clear</Text>
              <Text style={styles.emptySub}>
                Pending tool-use requests will appear here in real time.
              </Text>
              <Text style={styles.emptySub2}>
                Run{' '}
                <Text style={styles.code}>node relay.cjs mobile</Text>
                {' '}on your machine to enable mobile approvals.
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
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop:      Spacing.lg,
    paddingBottom:   Spacing.md,
    backgroundColor: Colors.bgPrimary,
    borderBottomWidth: 0.5,
    borderColor:     Colors.border,
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
    backgroundColor: Colors.primary,
    borderRadius:    Radius.full,
    minWidth:        22,
    height:          22,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color:      Colors.white,
    fontSize:   FontSize.xs,
    fontWeight: '700',
  },
  liveIndicator: {
    fontSize:  FontSize.xs,
    color:     Colors.success,
    fontWeight:'600',
  },
  listContent: {
    paddingVertical: Spacing.sm,
    paddingBottom:   Spacing.xxxl,
  },
  emptyContainer: {
    flex:           1,
    justifyContent: 'center',
  },
  empty: {
    alignItems:       'center',
    paddingHorizontal: Spacing.xxxl,
    gap:              Spacing.md,
  },
  emptyIcon: {
    width:           64,
    height:          64,
    borderRadius:    Radius.full,
    backgroundColor: Colors.risk.low.bg,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Spacing.sm,
  },
  emptyIconText: {
    fontSize:   24,
    color:      Colors.risk.low.text,
    fontWeight: '700',
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
  emptySub2: {
    fontSize:   FontSize.sm,
    color:      Colors.textTertiary,
    textAlign:  'center',
    lineHeight: 20,
    marginTop:  Spacing.xs,
  },
  code: {
    fontFamily:      'monospace',
    backgroundColor: Colors.bgTertiary,
    color:           Colors.primary,
  },
})
