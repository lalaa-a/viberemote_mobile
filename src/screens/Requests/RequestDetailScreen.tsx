import React, { useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, StatusBar, Platform,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack'
import { formatDistanceToNow } from 'date-fns'
import { useRequest, useDecideRequest } from '../../hooks/useRequests'
import { DiffViewer } from '../../components/DiffViewer/DiffViewer'
import { RiskBadge } from '../../components/RiskBadge'
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/colors'
import { useAppStore } from '../../store/useAppStore'
import type { RequestsStackParamList } from '../../types'

type Route = RouteProp<RequestsStackParamList, 'RequestDetail'>
type Nav   = NativeStackNavigationProp<RequestsStackParamList>

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

export function RequestDetailScreen() {
  const route      = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { id }     = route.params

  const { data: request, isLoading } = useRequest(id)
  const decide    = useDecideRequest()
  const showToast = useAppStore(s => s.showToast)

  async function handleDecide(decision: 'approved' | 'denied') {
    if (!request) return

    const label = decision === 'approved' ? 'Approve' : 'Deny'
    Alert.alert(
      `${label} this request?`,
      request.summary,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text:  label,
          style: decision === 'denied' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await decide.mutateAsync({ id, decision })
              showToast(
                decision === 'approved' ? 'Request approved' : 'Request denied',
                decision === 'approved' ? 'success' : 'error'
              )
              navigation.goBack()
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to update request')
            }
          },
        },
      ]
    )
  }

  if (isLoading || !request) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const alreadyDecided = request.status !== 'pending'
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true })

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgPrimary} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.toolName}>{request.tool_name}</Text>
            <RiskBadge level={request.risk_level} />
          </View>
          <Text style={styles.summary}>{request.summary}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Machine</Text>
              <View style={styles.metaValueRow}>
                <View style={[
                  styles.onlineDot,
                  { backgroundColor: request.machines?.is_online
                    ? Colors.success : Colors.textTertiary }
                ]} />
                <Text style={styles.metaValue}>
                  {request.machines?.label ?? 'Unknown'}
                </Text>
              </View>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Risk</Text>
              <Text style={styles.metaValue}>{request.risk_reason}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Time</Text>
              <Text style={styles.metaValue}>{timeAgo}</Text>
            </View>
          </View>
        </View>

        {/* ── Bash command ── */}
        {request.command && (
          <Section title="Command">
            <View style={styles.codeBlock}>
              <Text style={styles.dollarSign}>$</Text>
              <Text style={styles.commandText} selectable>
                {request.command}
              </Text>
            </View>
          </Section>
        )}

        {/* ── Files affected ── */}
        {request.files_affected?.length > 0 && (
          <Section title={`Files (${request.files_affected.length})`}>
            <View style={styles.filesList}>
              {request.files_affected.map((f, i) => (
                <View key={i} style={styles.fileRow}>
                  <Text style={styles.fileIcon}>F</Text>
                  <Text style={styles.fileText} selectable numberOfLines={1}>
                    {f}
                  </Text>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* ── Diff viewer ── */}
        {request.diff && (
          <Section
            title={`Changes  +${
              request.diff.grand_stats?.added ?? request.diff.stats?.added ?? 0
            }  -${
              request.diff.grand_stats?.removed ?? request.diff.stats?.removed ?? 0
            }`}
          >
            <DiffViewer diff={request.diff} />
          </Section>
        )}

        {/* ── Already decided banner ── */}
        {alreadyDecided && (
          <View style={[
            styles.decidedBanner,
            {
              backgroundColor: request.status === 'approved'
                ? Colors.risk.low.bg
                : Colors.risk.critical.bg,
              borderColor: request.status === 'approved'
                ? Colors.risk.low.border
                : Colors.risk.critical.border,
            },
          ]}>
            <Text style={[
              styles.decidedText,
              {
                color: request.status === 'approved'
                  ? Colors.risk.low.text
                  : Colors.risk.critical.text,
              },
            ]}>
              {request.status === 'approved' ? '✓' : '✕'}{' '}
              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
              {request.decided_by ? ` via ${request.decided_by}` : ''}
            </Text>
          </View>
        )}

        {/* Padding for bottom buttons */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Approve / Deny buttons ── */}
      {!alreadyDecided && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, styles.denyBtn]}
            onPress={() => handleDecide('denied')}
            disabled={decide.isPending}
            activeOpacity={0.8}
          >
            <Text style={styles.denyText}>Deny</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.approveBtn]}
            onPress={() => handleDecide('approved')}
            disabled={decide.isPending}
            activeOpacity={0.8}
          >
            {decide.isPending
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.approveText}>Approve</Text>
            }
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: Colors.bgSecondary,
  },
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  content: {
    padding:     Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap:         Spacing.md,
  },

  // Header card
  headerCard: {
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.lg,
    padding:         Spacing.lg,
    gap:             Spacing.md,
    borderWidth:     0.5,
    borderColor:     Colors.border,
    ...Shadow.card,
  },
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  toolName: {
    fontSize:   FontSize.xl,
    fontWeight: '700',
    color:      Colors.textPrimary,
  },
  summary: {
    fontSize:   FontSize.md,
    color:      Colors.textSecondary,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection:  'row',
    gap:            Spacing.xl,
    paddingTop:     Spacing.sm,
    borderTopWidth: 0.5,
    borderColor:    Colors.borderLight,
  },
  metaItem: {
    gap: 3,
    flex: 1,
  },
  metaLabel: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
    fontWeight:'600',
    textTransform: 'uppercase',
    letterSpacing:  0.5,
  },
  metaValueRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  onlineDot: {
    width:        6,
    height:       6,
    borderRadius: Radius.full,
  },
  metaValue: {
    fontSize:  FontSize.xs,
    color:     Colors.textSecondary,
    fontWeight:'500',
    flex:      1,
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize:      FontSize.xs,
    fontWeight:    '600',
    color:         Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Command block
  codeBlock: {
    flexDirection:   'row',
    backgroundColor: Colors.bgTertiary,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    gap:             Spacing.sm,
    borderWidth:     0.5,
    borderColor:     Colors.border,
  },
  dollarSign: {
    fontFamily: MONO,
    fontSize:   FontSize.sm,
    color:      Colors.textTertiary,
    lineHeight: 20,
  },
  commandText: {
    fontFamily: MONO,
    fontSize:   FontSize.sm,
    color:      Colors.textPrimary,
    flex:       1,
    lineHeight: 20,
  },

  // Files list
  filesList: {
    backgroundColor: Colors.cardBg,
    borderRadius:    Radius.md,
    borderWidth:     0.5,
    borderColor:     Colors.border,
    overflow:        'hidden',
  },
  fileRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             Spacing.sm,
    padding:         Spacing.md,
    borderBottomWidth: 0.5,
    borderColor:     Colors.borderLight,
  },
  fileIcon: {
    fontSize:        FontSize.xs,
    fontWeight:      '700',
    color:           Colors.primary,
    backgroundColor: Colors.primaryLight,
    width:           18,
    height:          18,
    textAlign:       'center',
    lineHeight:      18,
    borderRadius:    Radius.sm,
  },
  fileText: {
    fontFamily: MONO,
    fontSize:   FontSize.xs,
    color:      Colors.textPrimary,
    flex:       1,
  },

  // Decided banner
  decidedBanner: {
    borderRadius: Radius.md,
    padding:      Spacing.md,
    borderWidth:  0.5,
    alignItems:   'center',
  },
  decidedText: {
    fontSize:   FontSize.sm,
    fontWeight: '600',
  },

  // Action buttons
  actions: {
    position:        'absolute',
    bottom:          0,
    left:            0,
    right:           0,
    flexDirection:   'row',
    gap:             Spacing.md,
    padding:         Spacing.lg,
    paddingBottom:   Platform.OS === 'ios' ? 32 : Spacing.lg,
    backgroundColor: Colors.bgPrimary,
    borderTopWidth:  0.5,
    borderColor:     Colors.border,
    ...Shadow.modal,
  },
  btn: {
    flex:           1,
    paddingVertical: Spacing.lg,
    borderRadius:   Radius.md,
    alignItems:     'center',
    justifyContent: 'center',
  },
  denyBtn: {
    backgroundColor: Colors.bgSecondary,
    borderWidth:     0.5,
    borderColor:     Colors.border,
  },
  denyText: {
    fontSize:   FontSize.md,
    fontWeight: '600',
    color:      Colors.danger,
  },
  approveBtn: {
    backgroundColor: Colors.primary,
  },
  approveText: {
    fontSize:   FontSize.md,
    fontWeight: '600',
    color:      Colors.white,
  },
})
