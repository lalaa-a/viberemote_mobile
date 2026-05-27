import React, { useRef, useEffect } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, TouchableOpacity, StatusBar, Animated,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatDistanceToNow } from 'date-fns'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useSessions } from '../../hooks/useSessions'
import { GradientBackground } from '../../components/GradientBackground'
import { Colors, Spacing, Radius, FontSize, FontFamily, Shadow, TAB_BOTTOM_INSET } from '../../constants/colors'
import type { SessionsStackParamList, AgentSession } from '../../types'

type Nav = NativeStackNavigationProp<SessionsStackParamList>

const STATUS_COLOR: Record<string, string> = {
  active:   Colors.success,
  idle:     Colors.warning,
  finished: Colors.textTertiary,
}

// ── Pulsing dot ───────────────────────────────────────────────────────────────
function PulseDot({ color, active }: { color: string; active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.7, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 900, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [active])

  return (
    <View style={styles.dotWrap}>
      {active && (
        <Animated.View style={[
          styles.dotPulse,
          { backgroundColor: color, transform: [{ scale: pulse }] },
        ]} />
      )}
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  )
}

// ── Session card ──────────────────────────────────────────────────────────────
function SessionCard({ session, onDetail, onPrompt }: {
  session:  AgentSession
  onDetail: () => void
  onPrompt: () => void
}) {
  const dotColor    = STATUS_COLOR[session.status] ?? Colors.textTertiary
  const statusLabel = session.status === 'active' ? 'Active'
                    : session.status === 'idle'   ? 'Idle' : 'Finished'
  const canPrompt   = session.pending_count === 0 && session.status !== 'finished'
  const isActive    = session.status === 'active'

  return (
    <View style={styles.card}>
      {/* Top row: status pill · tool icon */}
      <View style={styles.cardTop}>
        <View style={styles.statusPill}>
          <PulseDot color={dotColor} active={isActive} />
          <Text style={[styles.statusText, { color: dotColor }]}>{statusLabel}</Text>
        </View>
        <Ionicons name="terminal-outline" size={18} color={Colors.accentDeep}/>
      </View>

      {/* Title */}
      <Text style={styles.cardTitle} numberOfLines={2}>
        {session.machine_label}
      </Text>

      {/* Path row */}
      <View style={styles.pathRow}>
        <Ionicons name="folder-outline" size={14} color={Colors.textTertiary} />
        <Text style={styles.pathText} numberOfLines={1}>{session.cwd ?? '~'}</Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.promptBtn, !canPrompt && styles.promptBtnDisabled]}
          disabled={!canPrompt}
          onPress={onPrompt}
          activeOpacity={0.8}
        >
          <Ionicons
            name="chatbubble-outline"
            size={15}
            color={canPrompt ? '#fff' : Colors.textTertiary}
          />
          <Text style={[styles.promptBtnText, !canPrompt && styles.promptBtnTextDisabled]}>
            {session.pending_count > 0 ? 'Approvals pending' : 'Prompt'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.detailBtn, 
          !canPrompt && styles.promptBtnDisabled]} 
          onPress={onDetail} activeOpacity={0.7} 
          disabled={!canPrompt}
        >
          
          <Text style={styles.detailBtnText}>Detail  </Text>
          <Ionicons
            name="arrow-forward-outline"
            size={15}
            color={canPrompt ? '#fff' : Colors.textTertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ── Screen ────────────────────────────────────────────────────────────────────
export function SessionsScreen() {
  const navigation  = useNavigation<Nav>()
  const insets      = useSafeAreaInsets()
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
        onPrompt={() => navigation.navigate('PromptCompose', { sessionId: item.session_id })}
      />
    )
  }

  return (
    <GradientBackground>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.appName}>Vibe Remote</Text>
          <Text style={styles.title}>Sessions</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>live</Text>
        </View>
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
                Sessions appear once{' '}
                <Text style={styles.code}>hook.js</Text>
                {' '}intercepts a tool call.
              </Text>
            </View>
          )
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
  liveIndicator: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    backgroundColor:   Colors.surfaceGlassStrong,
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.px8,
    paddingVertical:   4,
    borderWidth:       1,
    borderColor:       Colors.borderHairline,
  },
  liveDot: {
    width:           8,
    height:          8,
    borderRadius:    Radius.full,
    backgroundColor: Colors.accent,
  },
  liveText: {
    fontSize:  FontSize.label,
    color:     Colors.textSecondary,
    fontStyle: 'italic',
  },
  listContent: {
    paddingHorizontal: Spacing.px20,
    paddingTop:        Spacing.px4,
    paddingBottom:     TAB_BOTTOM_INSET,
    gap:               Spacing.px12,
  },

  // Card
  card: {
    backgroundColor: Colors.bgPrimary,
    borderRadius:    Radius.md,
    padding:         Spacing.px20,
    gap:             Spacing.px16,
    shadowColor:     '#A08060',
    shadowOffset:    { width: 0, height: 6 },
    shadowOpacity:   0.13,
    shadowRadius:    20,
    elevation:       5,
  },
  cardTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  dotWrap: {
    width:          8,
    height:         8,
    alignItems:     'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position:     'absolute',
    width:        8,
    height:       8,
    borderRadius: Radius.full,
    opacity:      0.30,
  },
  dot: {
    width:        7,
    height:       7,
    borderRadius: Radius.full,
  },
  statusPill: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               6,
    backgroundColor:   'rgba(0,0,0,0.06)',
    borderRadius:      Radius.full,
    paddingHorizontal: Spacing.px12,
    paddingVertical:   6,
  },
  statusText: {
    fontSize:   FontSize.label,
    fontWeight: '500',
    color:      Colors.textSecondary,
  },
  cardTitle: {
    fontSize:      20,
    fontFamily:    FontFamily.serif,
    color:         Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight:    26,
  },
  pathRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.px8,
    backgroundColor:   'rgba(0,0,0,0.04)',
    borderRadius:      Radius.sm,
    paddingHorizontal: Spacing.px12,
    paddingVertical:   Spacing.px8,
  },
  pathText: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.monoSmall,
    color:      Colors.textSecondary,
    flex:       1,
  },
  actions: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.px12,
    marginTop:     Spacing.px4,
  },
  promptBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            Spacing.px8,
    height:         48,
    borderRadius:   Radius.full,
    backgroundColor: Colors.accentDeep,
    shadowColor:    Colors.accentDeep,
    shadowOffset:   { width: 0, height: 4 },
    shadowOpacity:  0.35,
    shadowRadius:   12,
    elevation:      4,
  },
  promptBtnDisabled: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    shadowOpacity:   0,
    elevation:       0,
  },
  promptBtnText: {
    fontSize:   FontSize.label,
    fontWeight: '600',
    color:      '#FFFFFF',
  },
  promptBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  detailBtn: {
    flex:           1,
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    height:         48,
    borderRadius:   Radius.full,
    borderColor:    'rgba(0,0,0,0.12)',
  },
  detailBtnText: {
    fontSize:   FontSize.label,
    fontWeight: '600',
    color:      Colors.textSecondary,
  },

  // Empty
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
    maxWidth:   280,
  },
  code: {
    fontSize: FontSize.monoSmall,
    color:    Colors.accent,
  },
})
