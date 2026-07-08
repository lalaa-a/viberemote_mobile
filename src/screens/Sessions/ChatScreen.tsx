import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native'
import type { NativeSyntheticEvent, NativeScrollEvent } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatDistanceToNow } from 'date-fns'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useChatFeed } from '../../hooks/useChatFeed'
import type { ChatItem } from '../../hooks/useChatFeed'
import { useDecideRequest, useAnswerRequest } from '../../hooks/useRequests'
import { useSendPrompt, useSessions } from '../../hooks/useSessions'
import { useMachineChannel } from '../../hooks/useMachineChannel'
import { GradientBackground } from '../../components/GradientBackground'
import { HarnessAvatar } from '../../components/HarnessAvatar'
import { QuestionCard } from '../../components/QuestionCard'
import { TerminalText } from '../../components/chat/TerminalText'
import { BackButton } from '../../components/ui/BackButton'
import { Button } from '../../components/ui/Button'
import { Badge, RISK_VARIANT } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import {
  DarkColors, DarkToolTint, Spacing, Radius, FontSize, FontFamily,
} from '../../constants/colors'
import type {
  SessionsStackParamList, PendingRequest, TerminalEvent, MobileCommand, SelectedAnswer,
} from '../../types'

type Route = RouteProp<SessionsStackParamList, 'Chat'>
type Nav   = NativeStackNavigationProp<SessionsStackParamList>

const TOOL_ICONS: Record<string, string> = {
  Bash: 'terminal-outline', bash: 'terminal-outline',
  Write: 'document-outline', write: 'document-outline',
  Edit: 'create-outline', edit: 'create-outline',
  MultiEdit: 'documents-outline', patch: 'git-merge-outline',
  Read: 'eye-outline', read: 'eye-outline',
}

// Reveal-once guards — an output row types out exactly once; if it recycles or
// isn't the live edge, it renders in full instantly (see plan §13.3/13.4).
const revealedOutputIds = new Set<string>()
const seenActivityIds   = new Set<string>()

function dirName(cwd: string | null) {
  if (!cwd) return '~'
  return cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
}

// ── Agent reasoning — plain CLI output (no bubble), streamed ──────────────────
function OutputBubble({ event, isLast }: { event: TerminalEvent; isLast: boolean }) {
  const [expanded, setExpanded] = useState(true)
  const text = event.summary ?? ''
  const isLong = text.length > 400
  const display = expanded ? text : text.slice(0, 400) + '…'
  const animate = isLast && !revealedOutputIds.has(event.id)

  return (
    <View style={styles.outputBlock}>
      <TerminalText
        text={display}
        animate={animate}
        onDone={() => revealedOutputIds.add(event.id)}
        style={styles.outputText}
      />
      {isLong && (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} activeOpacity={0.7} hitSlop={6}>
          <Text style={styles.showMore}>{expanded ? 'Show less ↑' : 'Show more ↓'}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── User sent-prompt bubble (right) ───────────────────────────────────────────
function SentBubble({ cmd }: { cmd: MobileCommand }) {
  const icon = cmd.status === 'delivered'
    ? 'checkmark-done' : cmd.status === 'pending'
    ? 'time-outline' : 'close-outline'
  const iconColor = cmd.status === 'delivered' ? DarkColors.online : DarkColors.textTertiary

  return (
    <View style={styles.rowRight}>
      <View style={styles.bubbleSent}>
        <Text style={styles.bubbleSentText}>{cmd.prompt}</Text>
        <View style={styles.bubbleSentMeta}>
          <Text style={styles.bubbleSentTime}>
            {formatDistanceToNow(new Date(cmd.created_at), { addSuffix: true })}
          </Text>
          <Ionicons name={icon} size={12} color={iconColor} />
        </View>
      </View>
    </View>
  )
}

// ── Notification (centred) ────────────────────────────────────────────────────
function NotifyRow({ event }: { event: TerminalEvent }) {
  return (
    <View style={styles.notifyRow}>
      <Text style={styles.notifyText}>{event.summary}</Text>
    </View>
  )
}

// ── Task-complete divider ─────────────────────────────────────────────────────
function StopRow({ event }: { event: TerminalEvent }) {
  return (
    <View style={styles.stopRow}>
      <View style={styles.stopLine} />
      <View style={styles.stopPill}>
        <Ionicons name="checkmark-done-circle" size={13} color={DarkColors.online} />
        <Text style={styles.stopText}>Task complete</Text>
        <Text style={styles.stopTime}>
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </Text>
      </View>
      <View style={styles.stopLine} />
    </View>
  )
}

// ── Tool approval card ────────────────────────────────────────────────────────
function RequestCard({ req, onApprove, onDeny, onOpen }: {
  req:       PendingRequest
  onApprove: () => void
  onDeny:    () => void
  onOpen:    () => void
}) {
  const toolTint   = DarkToolTint[req.tool_name as string] ?? DarkToolTint.unknown
  const iconName   = TOOL_ICONS[req.tool_name as string] ?? 'cube-outline'
  const isPending  = req.status === 'pending'
  const isApproved = req.status === 'approved'
  const canInspect = !!req.diff || !!req.command || (req.files_affected?.length ?? 0) > 0

  return (
    <Card>
      {/* Tool + risk header */}
      <View style={styles.reqHeader}>
        <View style={[styles.reqIconBox, { backgroundColor: toolTint.bg }]}>
          <Ionicons name={iconName} size={14} color={toolTint.fg} />
        </View>
        <Text style={styles.reqToolName}>{req.tool_name}</Text>
        <Badge variant={RISK_VARIANT[req.risk_level] ?? 'neutral'}>{req.risk_level}</Badge>
        {!isPending && (
          <Badge variant={isApproved ? 'success' : 'danger'}>
            {isApproved ? 'Approved' : 'Denied'}
          </Badge>
        )}
      </View>

      {/* Summary */}
      <Text style={styles.reqSummary} numberOfLines={isPending ? 6 : 3}>{req.summary}</Text>

      {/* Command code block */}
      {!!req.command && (
        <View style={styles.reqCode}>
          <Text style={styles.reqCodeText} numberOfLines={4}>{req.command}</Text>
        </View>
      )}

      {/* Tap-to-inspect (full diff / details live on RequestDetail) */}
      {canInspect && (
        <TouchableOpacity style={styles.reqOpenHint} onPress={onOpen} activeOpacity={0.7}>
          <Ionicons name="document-text-outline" size={17} color={DarkColors.textSecondary} />
          <Text style={styles.reqOpenHintText}>{req.diff ? 'View full diff' : 'View details'}</Text>
          <Ionicons name="chevron-forward" size={17} color={DarkColors.textSecondary} />
        </TouchableOpacity>
      )}

      {/* Action buttons (only while pending) */}
      {isPending && (
        <View style={styles.reqActions}>
          <Button variant="destructive" size="sm" icon="close" style={styles.flexBtn} onPress={onDeny}>
            Deny
          </Button>
          <Button variant="success" size="sm" icon="checkmark" style={styles.flexBtn} onPress={onApprove}>
            Approve
          </Button>
        </View>
      )}

      <Text style={styles.reqTime}>
        {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
      </Text>
    </Card>
  )
}

// ── Animated thinking dots — plain inline (no bubble) ─────────────────────────
function ThinkingBubble({ isPendingApproval }: { isPendingApproval: boolean }) {
  const color = isPendingApproval ? DarkColors.unpair : DarkColors.online
  const label = isPendingApproval ? 'Waiting for approval…' : 'Thinking…'
  return (
    <View style={styles.thinkingRow}>
      <View style={styles.thinkingDots}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={[styles.dot, { backgroundColor: color, opacity: 0.6 }]} />
        <View style={[styles.dot, { backgroundColor: color, opacity: 0.3 }]} />
      </View>
      <Text style={[styles.thinkingLabel, { color }]}>{label}</Text>
    </View>
  )
}

// ── Activity bubble — compact tool_start / tool_end row ───────────────────────
function ActivityBubble({ event, isLast }: { event: TerminalEvent; isLast: boolean }) {
  const isStart  = event.event_type === 'tool_start'
  const iconName = TOOL_ICONS[event.tool_name ?? ''] ?? 'cube-outline'
  const toolTint = DarkToolTint[(event.tool_name ?? '') as string] ?? DarkToolTint.unknown
  const fadeIn   = isLast && !seenActivityIds.has(event.id)

  useEffect(() => { seenActivityIds.add(event.id) }, [event.id])

  const Row = fadeIn ? Animated.View : View
  const rowProps = fadeIn ? { entering: FadeInDown.duration(220) } : {}

  return (
    <Row style={styles.activityRow} {...rowProps}>
      <View style={[styles.activityIcon, { backgroundColor: toolTint.bg }]}>
        <Ionicons name={iconName} size={11} color={toolTint.fg} />
      </View>
      <Text style={styles.activityText} numberOfLines={2}>
        <Text style={{ fontWeight: '600', color: toolTint.fg }}>{event.tool_name}</Text>
        {event.summary ? `  ${event.summary}` : ''}
      </Text>
      <View style={[styles.activityBadge, isStart ? styles.activityBadgeStart : styles.activityBadgeDone]}>
        <Text style={[styles.activityBadgeText, { color: isStart ? DarkColors.unpair : DarkColors.online }]}>
          {isStart ? 'running' : 'done'}
        </Text>
      </View>
    </Row>
  )
}

// ── Feed item renderer ────────────────────────────────────────────────────────
const FeedRow = React.memo(function FeedRow({ item, isLast, onApprove, onDeny, onOpen, onAnswer }: {
  item:      ChatItem
  isLast:    boolean
  onApprove: (id: string) => void
  onDeny:    (id: string) => void
  onOpen:    (id: string) => void
  onAnswer:  (id: string, answers: SelectedAnswer[]) => void
}) {
  if (item.kind === 'output')   return <OutputBubble   event={item.event} isLast={isLast} />
  if (item.kind === 'activity') return <ActivityBubble event={item.event} isLast={isLast} />
  if (item.kind === 'sent')     return <SentBubble     cmd={item.cmd} />
  if (item.kind === 'notify')   return <NotifyRow      event={item.event} />
  if (item.kind === 'stop')     return <StopRow        event={item.event} />
  if (item.req.kind === 'question') {
    return <QuestionCard request={item.req} onSubmit={(answers) => onAnswer(item.req.id, answers)} />
  }
  return (
    <RequestCard
      req={item.req}
      onApprove={() => onApprove(item.req.id)}
      onDeny={()    => onDeny(item.req.id)}
      onOpen={()    => onOpen(item.req.id)}
    />
  )
})

// ── Screen ────────────────────────────────────────────────────────────────────
export function ChatScreen() {
  const route      = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const insets     = useSafeAreaInsets()
  const { sessionId, machineLabel, cwd, machineIsOnline, harness, status, prefill } = route.params

  const { feed, isLoading, isRefetching, fetchOlder, isFetchingOlder } = useChatFeed(sessionId)
  const decide  = useDecideRequest()
  const answer  = useAnswerRequest()
  const sendPmt = useSendPrompt()

  const { data: sessions = [] } = useSessions()
  const liveSession    = sessions.find(s => s.session_id === sessionId)
  const liveStatus     = liveSession?.status     ?? status
  const liveOnline     = liveSession?.machine_is_online ?? machineIsOnline
  const cliClosed      = liveSession?.cli_alive === false && liveStatus !== 'active'
  const harnessOff     = liveSession?.harness_enabled === false

  useMachineChannel(liveSession?.machine_id)

  const [prompt, setPrompt] = useState(prefill ?? '')
  const listRef = useRef<FlatList>(null)

  const isNearBottomRef    = useRef(true)
  const didInitialScroll   = useRef(false)
  const [showJumpToLatest, setShowJumpToLatest] = useState(false)

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
    const near = distanceFromBottom < 120
    isNearBottomRef.current = near
    setShowJumpToLatest(!near)
  }, [])

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }))
    isNearBottomRef.current = true
    setShowJumpToLatest(false)
  }, [])

  useFocusEffect(useCallback(() => {
    if (route.params.prefill) setPrompt(route.params.prefill)
  }, [route.params.prefill])) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (feed.length > 0 && isNearBottomRef.current) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))
    }
  }, [feed.length])

  const pendingCount = feed.filter(i => i.kind === 'request' && i.req.status === 'pending').length
  const isActive     = liveStatus === 'active'
  const lastItem     = feed[feed.length - 1]
  const lastId       = lastItem?.id
  const lastIsStop   = lastItem?.kind === 'stop'
  const showThinking = isActive && !lastIsStop

  const handleApprove = useCallback((id: string) => decide.mutate({ id, decision: 'approved' }), [decide])
  const handleDeny    = useCallback((id: string) => decide.mutate({ id, decision: 'denied'   }), [decide])
  const handleOpen    = useCallback((id: string) => navigation.navigate('RequestDetail', { id }), [navigation])
  const handleAnswer  = useCallback(
    (id: string, answers: SelectedAnswer[]) => answer.mutate({ id, answers }),
    [answer],
  )

  const renderItem = useCallback(
    ({ item }: { item: ChatItem }) => (
      <FeedRow
        item={item}
        isLast={item.id === lastId}
        onApprove={handleApprove}
        onDeny={handleDeny}
        onOpen={handleOpen}
        onAnswer={handleAnswer}
      />
    ),
    [handleApprove, handleDeny, handleOpen, handleAnswer, lastId],
  )

  async function handleSend() {
    const text = prompt.trim()
    if (!text) return
    try {
      await sendPmt.mutateAsync({ prompt: text, sessionId })
      setPrompt('')
    } catch (err: any) {
      Alert.alert('Failed to send', err.message ?? 'Please try again')
    }
  }

  const dirLabel = dirName(cwd)
  const canType  = liveOnline && pendingCount === 0 && !cliClosed && !harnessOff
  const canSend  = prompt.trim().length > 0 && !sendPmt.isPending && canType

  const statusColor = isActive ? DarkColors.online : liveStatus === 'idle' ? DarkColors.unpair : DarkColors.textTertiary
  const statusLabel = isActive ? 'Active' : liveStatus === 'idle' ? 'Idle' : 'Finished'

  return (
    <GradientBackground style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <KeyboardAvoidingView
        style={styles.flex}
        // Android manifest already uses adjustResize — letting it handle the
        // keyboard alone avoids the double-count that left the compose bar sitting
        // higher after dismissing the keyboard. iOS still needs 'padding'.
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >

        {/* ── Header (refer Details: BackButton + pill + icon btn) ── */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <BackButton />
          <View style={styles.titlePill}>
            <HarnessAvatar
              harness={harness}
              dir={dirLabel}
              statusColor={statusColor}
              isActive={isActive}
              size={34}
            />
            <Text style={styles.titleText} numberOfLines={1}>{dirLabel}</Text>
            {isRefetching && <ActivityIndicator size="small" color={DarkColors.textSecondary} />}
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, !machineIsOnline && { opacity: 0.4 }]}
            onPress={() => navigation.navigate('FileBrowser', { sessionId, machineLabel, cwd })}
            disabled={!machineIsOnline}
            activeOpacity={0.75}
          >
            <Ionicons name="folder-outline" size={18} color={DarkColors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Status strip ── */}
        <View style={styles.statusStrip}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={styles.statusSep}>·</Text>
          <Text style={styles.statusMachine} numberOfLines={1}>{machineLabel}</Text>
          {!liveOnline && <Text style={styles.offlineChip}>machine offline</Text>}
        </View>

        {/* ── Message feed ── */}
        {isLoading && feed.length === 0 ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={DarkColors.online} />
            <Text style={styles.loadingText}>Loading conversation…</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.flex}
            data={feed}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={[
              styles.listContent,
              feed.length === 0 && styles.listContentEmpty,
            ]}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            onStartReached={fetchOlder}
            onStartReachedThreshold={0.3}
            ListHeaderComponent={isFetchingOlder
              ? <View style={styles.loadingOlder}><ActivityIndicator size="small" color={DarkColors.textTertiary} /></View>
              : null
            }
            onContentSizeChange={() => {
              if (!didInitialScroll.current && feed.length > 0) {
                listRef.current?.scrollToEnd({ animated: false })
                didInitialScroll.current = true
              } else if (isNearBottomRef.current) {
                listRef.current?.scrollToEnd({ animated: false })
              }
            }}
            windowSize={11}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            removeClippedSubviews
            ListFooterComponent={showThinking
              ? <ThinkingBubble isPendingApproval={pendingCount > 0} />
              : null
            }
            ListEmptyComponent={
              !showThinking ? (
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={40} color={DarkColors.textSecondary} />
                  <Text style={styles.emptyTitle}>No activity yet</Text>
                  <Text style={styles.emptySub}>
                    Reasoning and tool calls will appear here as the agent works.
                  </Text>
                </View>
              ) : null
            }
          />
        )}

        {/* ── Jump to latest ── */}
        {showJumpToLatest && feed.length > 0 && (
          <TouchableOpacity
            style={[styles.jumpToLatest, { bottom: insets.bottom + 80 }]}
            onPress={() => scrollToLatest(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
            <Text style={styles.jumpToLatestText}>Latest</Text>
          </TouchableOpacity>
        )}

        {/* ── Compose bar ── */}
        <View style={[styles.compose, { paddingBottom: insets.bottom + Spacing.px20 }]}>
          {cliClosed ? (
            <View style={styles.closedNote}>
              <Ionicons name="lock-closed" size={16} color={DarkColors.danger} />
              <View style={styles.closedTextWrap}>
                <Text style={styles.closedTitle}>CLI is closed</Text>
                <Text style={styles.closedSub}>
                  This session's terminal was closed. Start the agent again on your
                  computer to continue — prompts can't be sent to a closed CLI.
                </Text>
              </View>
            </View>
          ) : harnessOff ? (
            <View style={styles.harnessOffNote}>
              <Ionicons name="power" size={16} color={DarkColors.unpair} />
              <View style={styles.closedTextWrap}>
                <Text style={[styles.closedTitle, { color: DarkColors.unpair }]}>Mobile support is off</Text>
                <Text style={styles.closedSub}>
                  Turn on mobile support for {harness} in the Vibe Remote desktop app
                  to send prompts to this session.
                </Text>
              </View>
            </View>
          ) : pendingCount > 0 ? (
            <View style={styles.pendingNote}>
              <Ionicons name="hourglass-outline" size={14} color={DarkColors.unpair} />
              <Text style={styles.pendingText}>
                {pendingCount} approval{pendingCount > 1 ? 's' : ''} pending — scroll up to decide
              </Text>
            </View>
          ) : (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={prompt}
                onChangeText={setPrompt}
                placeholder={!liveOnline ? 'Machine offline — cannot send' : 'Send a prompt…'}
                placeholderTextColor={DarkColors.textTertiary}
                multiline
                editable={canType}
                maxLength={2000}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!canSend}
                activeOpacity={0.8}
              >
                {sendPmt.isPending
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="arrow-up" size={20} color={canSend ? '#FFFFFF' : DarkColors.textTertiary} />
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

      </KeyboardAvoidingView>
    </GradientBackground>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { backgroundColor: DarkColors.bg },
  flex: { flex: 1 },
  flexBtn: { flex: 1 },

  // ── Header ──
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px10,
    paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px10,
  },
  titlePill: {
    flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.px8,
    paddingLeft: 7, paddingRight: Spacing.px16, borderRadius: Radius.full,
    backgroundColor: DarkColors.surfaceRaised,
  },
  titleText: { fontSize: FontSize.cardTitle, fontWeight: '600', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, flexShrink: 1 },
  iconBtn: {
    width: 48, height: 48, borderRadius: Radius.full,
    backgroundColor: DarkColors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // ── Status strip ──
  statusStrip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px6,
    paddingHorizontal: Spacing.px20, paddingVertical: 6,
    backgroundColor: DarkColors.surface,
    borderBottomWidth: 1, borderBottomColor: DarkColors.border,
  },
  statusDot: { width: 6, height: 6, borderRadius: Radius.full },
  statusText: { fontSize: FontSize.metadata, fontWeight: '500', fontFamily: FontFamily.googleSans },
  statusSep: { fontSize: FontSize.metadata, color: DarkColors.textTertiary },
  statusMachine: { fontSize: FontSize.metadata, color: DarkColors.textTertiary, flex: 1, fontFamily: FontFamily.googleSans },
  offlineChip: {
    fontSize: FontSize.microLabel, color: DarkColors.danger, fontWeight: '600',
    marginLeft: Spacing.px8, backgroundColor: 'rgba(239,83,80,0.15)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.full,
  },

  // ── Feed ──
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.px12 },
  loadingText: { fontSize: FontSize.label, color: DarkColors.textTertiary, fontFamily: FontFamily.googleSans },
  loadingOlder: { paddingVertical: Spacing.px12, alignItems: 'center' },

  jumpToLatest: {
    position: 'absolute', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px4,
    backgroundColor: DarkColors.badgeBg,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px8,
  },
  jumpToLatestText: { fontSize: FontSize.label, color: '#FFFFFF', fontWeight: '600', fontFamily: FontFamily.googleSans },

  // One shared gutter + one uniform vertical rhythm for every feed item.
  listContent: {
    paddingHorizontal: Spacing.px16, paddingTop: Spacing.px12,
    paddingBottom: Spacing.px16, gap: Spacing.px12,
  },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },

  // ── Empty ──
  empty: { alignItems: 'center', paddingHorizontal: Spacing.px32, gap: Spacing.px12 },
  emptyTitle: { fontSize: FontSize.displayM, fontWeight: '600', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans },
  emptySub: { fontSize: FontSize.body, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans, textAlign: 'center', lineHeight: 22, maxWidth: 260 },

  // ── Row wrappers ──
  rowRight: { flexDirection: 'row', justifyContent: 'flex-end', paddingLeft: 48 },

  // ── Agent reasoning — plain full-width CLI output (aligned to gutter) ──
  outputBlock: { gap: 4 },
  outputText: { color: DarkColors.textPrimary, lineHeight: 21 },
  showMore: { fontSize: FontSize.metadata, color: DarkColors.online, fontWeight: '500', marginTop: 2 },

  // ── Sent bubble (user prompt) ──
  bubbleSent: {
    backgroundColor: DarkColors.surfaceRaised,
    borderRadius: Radius.md, borderTopRightRadius: 4,
    paddingHorizontal: Spacing.px12, paddingVertical: Spacing.px8,
    gap: 4, flexShrink: 1,
  },
  bubbleSentText: { fontSize: FontSize.body, color: DarkColors.textPrimary, lineHeight: 22, fontFamily: FontFamily.googleSans },
  bubbleSentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bubbleSentTime: { fontSize: FontSize.metadata, color: 'rgba(255,255,255,0.5)' },

  // ── Notification ──
  notifyRow: { alignItems: 'center', paddingHorizontal: Spacing.px16 },
  notifyText: { fontSize: FontSize.metadata, color: DarkColors.textTertiary, fontStyle: 'italic', textAlign: 'center' },

  // ── Stop divider ──
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, marginVertical: Spacing.px4 },
  stopLine: { flex: 1, height: 1, backgroundColor: DarkColors.border },
  stopPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: DarkColors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.px12, paddingVertical: 4,
  },
  stopText: { fontSize: FontSize.label, fontWeight: '600', color: DarkColors.online, fontFamily: FontFamily.googleSans },
  stopTime: { fontSize: FontSize.metadata, color: DarkColors.online, opacity: 0.7 },

  // ── Tool request card ──
  reqHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8 },
  reqIconBox: {
    width: 24, height: 24, borderRadius: Radius.xs,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  reqToolName: { fontSize: FontSize.label, fontWeight: '700', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, flex: 1 },
  reqSummary: { fontSize: FontSize.label, color: DarkColors.textSecondary, lineHeight: 18, fontFamily: FontFamily.mono },
  reqCode: {
    backgroundColor: DarkColors.bg, borderRadius: Radius.xs,
    paddingHorizontal: Spacing.px8, paddingVertical: Spacing.px4,
  },
  reqCodeText: { fontFamily: FontFamily.mono, fontSize: FontSize.monoSmall, color: DarkColors.textPrimary, lineHeight: 17 },
  reqOpenHint: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, marginTop: 2,
    paddingVertical: Spacing.px10, paddingHorizontal: Spacing.px12,
    backgroundColor: DarkColors.surfaceRaised, borderRadius: Radius.sm,
  },
  reqOpenHintText: { flex: 1, fontSize: FontSize.label, color: DarkColors.textSecondary, fontWeight: '600', fontFamily: FontFamily.googleSans },
  reqActions: { flexDirection: 'row', gap: Spacing.px8, marginTop: Spacing.px4 },
  reqTime: { fontSize: FontSize.microLabel, color: DarkColors.textTertiary, alignSelf: 'flex-end' },

  // ── Activity row (aligned to gutter) ──
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, marginVertical: Spacing.px6 },
  activityIcon: { width: 22, height: 22, borderRadius: Radius.xs, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  activityText: { flex: 1, fontSize: FontSize.metadata, color: DarkColors.textSecondary, fontFamily: FontFamily.mono },
  activityBadge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
  activityBadgeStart: { backgroundColor: 'rgba(217,164,65,0.18)' },
  activityBadgeDone:  { backgroundColor: 'rgba(39,224,126,0.18)' },
  activityBadgeText: { fontSize: 10, fontWeight: '600' },

  // ── Thinking (plain inline) ──
  thinkingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, paddingVertical: Spacing.px8, paddingLeft: Spacing.px12 },
  thinkingDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: Radius.full },
  thinkingLabel: { fontSize: FontSize.label, fontStyle: 'italic', fontFamily: FontFamily.googleSans },

  // ── Compose bar ──
  // No filled band — blends with the chat background (Telegram-style)
  compose: {
    paddingHorizontal: Spacing.px12, paddingTop: Spacing.px8,
    backgroundColor: 'transparent',
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.px8 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 120,
    backgroundColor: DarkColors.surfaceRaised,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: DarkColors.borderMid,
    paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px12,
    fontSize: FontSize.body, color: DarkColors.textPrimary,
    fontFamily: FontFamily.googleSans, lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: Radius.full,
    backgroundColor: DarkColors.badgeBg,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  sendBtnDisabled: { backgroundColor: DarkColors.surface },
  pendingNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, paddingVertical: Spacing.px12, justifyContent: 'center' },
  pendingText: { fontSize: FontSize.label, color: DarkColors.unpair, fontWeight: '500', fontFamily: FontFamily.googleSans },
  closedNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.px8,
    paddingVertical: Spacing.px12, paddingHorizontal: Spacing.px8,
    backgroundColor: 'rgba(239,83,80,0.12)', borderRadius: Radius.md,
  },
  harnessOffNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.px8,
    paddingVertical: Spacing.px12, paddingHorizontal: Spacing.px8,
    backgroundColor: 'rgba(217,164,65,0.12)', borderRadius: Radius.md,
  },
  closedTextWrap: { flex: 1, gap: 2 },
  closedTitle: { fontSize: FontSize.label, color: DarkColors.danger, fontWeight: '700', fontFamily: FontFamily.googleSans },
  closedSub: { fontSize: FontSize.metadata, color: DarkColors.textSecondary, lineHeight: 16, fontFamily: FontFamily.googleSans },
})
