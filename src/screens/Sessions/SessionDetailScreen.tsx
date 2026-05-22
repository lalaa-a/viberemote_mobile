import React from 'react'
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, StatusBar, ActivityIndicator,
  SectionList,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { formatDistanceToNow } from 'date-fns'
import { useSessionRequests, usePrompts, useCancelPrompt } from '../../hooks/useSessions'
import { RequestCard } from '../../components/RequestCard'
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/colors'
import type { SessionsStackParamList, PendingRequest, MobileCommand } from '../../types'

type Route = RouteProp<SessionsStackParamList, 'SessionDetail'>
type Nav   = NativeStackNavigationProp<SessionsStackParamList>

export function SessionDetailScreen() {
  const route      = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { sessionId, machineLabel, cwd, machineIsOnline } = route.params

  const { data: requests = [], isLoading: reqLoading } = useSessionRequests(sessionId)
  const { data: allPrompts = [] }                      = usePrompts()
  const cancelPrompt                                   = useCancelPrompt()

  const prompts = allPrompts.filter(p => p.session_id === sessionId)

  function renderRequest({ item }: { item: PendingRequest }) {
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
        <View style={styles.headerInfo}>
          <Text style={styles.cwd} numberOfLines={1}>{cwd ?? '~'}</Text>
          <Text style={styles.machine}>{machineLabel}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, !machineIsOnline && styles.actionBtnDisabled]}
            onPress={() => navigation.navigate('FileBrowser', { sessionId, machineLabel, cwd })}
            activeOpacity={0.7}
            disabled={!machineIsOnline}
          >
            <Text style={[styles.actionBtnText, !machineIsOnline && styles.actionBtnTextDisabled]}>
              {machineIsOnline ? 'Files' : 'Offline'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnPrimary]}
            onPress={() => navigation.navigate('PromptCompose', { sessionId })}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnPrimaryText}>Prompt</Text>
          </TouchableOpacity>
        </View>
      </View>

      <SectionList
        contentContainerStyle={styles.listContent}
        sections={[
          {
            title: `PENDING REQUESTS${requests.length > 0 ? ` (${requests.length})` : ''}`,
            data:  requests,
            key:   'requests',
          },
          {
            title: 'SENT PROMPTS',
            data:  prompts,
            key:   'prompts',
          },
        ]}
        keyExtractor={(item: PendingRequest | MobileCommand) => item.id}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => {
          if (section.key === 'requests') {
            const req = item as PendingRequest
            return (
              <RequestCard
                request={req}
                onPress={() => navigation.navigate('RequestDetail', { id: req.id })}
              />
            )
          }
          const cmd = item as MobileCommand
          return <PromptRow cmd={cmd} onCancel={() => cancelPrompt.mutate(cmd.id)} />
        }}
        ListEmptyComponent={null}
        renderSectionFooter={({ section }) => {
          if (section.key === 'requests' && !reqLoading && requests.length === 0) {
            return (
              <View style={styles.sectionEmpty}>
                <Text style={styles.sectionEmptyText}>No pending requests</Text>
              </View>
            )
          }
          if (section.key === 'prompts' && prompts.length === 0) {
            return (
              <View style={styles.sectionEmpty}>
                <Text style={styles.sectionEmptyText}>No prompts sent yet</Text>
              </View>
            )
          }
          return null
        }}
        stickySectionHeadersEnabled={false}
      />

      {reqLoading && (
        <ActivityIndicator
          style={styles.loader}
          size="small"
          color={Colors.primary}
        />
      )}
    </View>
  )
}

function PromptRow({ cmd, onCancel }: { cmd: MobileCommand; onCancel: () => void }) {
  const STATUS_ICON: Record<string, string> = {
    pending:   '⏳',
    delivered: '✓',
    cancelled: '✕',
  }
  const STATUS_COLOR: Record<string, string> = {
    pending:   Colors.warning,
    delivered: Colors.success,
    cancelled: Colors.textTertiary,
  }

  const icon  = STATUS_ICON[cmd.status]  ?? '?'
  const color = STATUS_COLOR[cmd.status] ?? Colors.textTertiary
  const timeAgo = formatDistanceToNow(new Date(cmd.created_at), { addSuffix: true })

  return (
    <View style={styles.promptRow}>
      <Text style={[styles.promptIcon, { color }]}>{icon}</Text>
      <View style={styles.promptBody}>
        <Text style={styles.promptText} numberOfLines={2}>{cmd.prompt}</Text>
        <Text style={styles.promptMeta}>
          {cmd.status} · {timeAgo}
        </Text>
      </View>
      {cmd.status === 'pending' && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
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
    paddingVertical:   Spacing.md,
    backgroundColor:   Colors.bgPrimary,
    borderBottomWidth: 0.5,
    borderColor:       Colors.border,
  },
  headerInfo: {
    flex: 1,
    gap:  2,
  },
  cwd: {
    fontFamily: 'monospace',
    fontSize:   FontSize.md,
    fontWeight: '600',
    color:      Colors.textPrimary,
  },
  machine: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  headerActions: {
    flexDirection: 'row',
    gap:           Spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical:   Spacing.sm,
    borderRadius:      Radius.sm,
    borderWidth:       0.5,
    borderColor:       Colors.border,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.primary,
    borderColor:     Colors.primary,
  },
  actionBtnDisabled: {
    borderColor: Colors.borderLight,
    opacity:     0.5,
  },
  actionBtnText: {
    fontSize:   FontSize.sm,
    fontWeight: '500',
    color:      Colors.textSecondary,
  },
  actionBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  actionBtnPrimaryText: {
    fontSize:   FontSize.sm,
    fontWeight: '600',
    color:      Colors.white,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  sectionHeader: {
    fontSize:          FontSize.xs,
    fontWeight:        '600',
    color:             Colors.textTertiary,
    textTransform:     'uppercase',
    letterSpacing:     0.5,
    paddingHorizontal: Spacing.lg,
    paddingTop:        Spacing.lg,
    paddingBottom:     Spacing.sm,
  },
  sectionEmpty: {
    marginHorizontal: Spacing.lg,
    paddingVertical:  Spacing.md,
    alignItems:       'center',
    backgroundColor:  Colors.cardBg,
    borderRadius:     Radius.md,
    borderWidth:      0.5,
    borderColor:      Colors.border,
  },
  sectionEmptyText: {
    fontSize:  FontSize.sm,
    color:     Colors.textTertiary,
  },
  loader: {
    position: 'absolute',
    top:      Spacing.lg,
    right:    Spacing.lg,
  },

  // Prompt row
  promptRow: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               Spacing.sm,
    marginHorizontal:  Spacing.lg,
    marginVertical:    Spacing.xs,
    backgroundColor:   Colors.cardBg,
    borderRadius:      Radius.md,
    borderWidth:       0.5,
    borderColor:       Colors.border,
    padding:           Spacing.md,
    ...Shadow.card,
  },
  promptIcon: {
    fontSize:   FontSize.md,
    lineHeight: 20,
  },
  promptBody: {
    flex: 1,
    gap:  3,
  },
  promptText: {
    fontSize:   FontSize.sm,
    color:      Colors.textPrimary,
    lineHeight: 18,
  },
  promptMeta: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical:   3,
    borderRadius:      Radius.sm,
    borderWidth:       0.5,
    borderColor:       Colors.risk.medium.border,
  },
  cancelText: {
    fontSize:   FontSize.xs,
    color:      Colors.risk.medium.text,
    fontWeight: '500',
  },
})
