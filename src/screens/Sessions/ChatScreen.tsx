import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
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
import { useSendPrompt, useSessions, useStopSession } from '../../hooks/useSessions'
import { useMachineChannel } from '../../hooks/useMachineChannel'
import { GradientBackground } from '../../components/GradientBackground'
import { HarnessAvatar } from '../../components/HarnessAvatar'
import { QuestionCard } from '../../components/QuestionCard'
import { TerminalText } from '../../components/chat/TerminalText'
import { SPINNER_WORDS } from '../Terminal/spinnerWords'
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

// Rotating status word ("Discombobulating…", "Pondering…") — mirrors what Claude Code
// shows on the desktop while it's thinking, so the phone reflects the same live status.
// Cycles every 2s while `active`; freezes (and stops the timer) when the turn isn't live.
function useSpinnerWord(active: boolean) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * SPINNER_WORDS.length))
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setIdx(i => (i + 1) % SPINNER_WORDS.length), 2000)
    return () => clearInterval(id)
  }, [active])
  return SPINNER_WORDS[idx]
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
  // A turn ends either by finishing normally or by an explicit Stop (from mobile or the
  // terminal). Both arrive as a `stop` event; an interrupt is tagged status==='stopped' so
  // the divider reads "Stopped" (not "Task complete"). The summary regex is a fallback for
  // events written before the explicit tag existed.
  const stopped = event.status === 'stopped' || /stopp?ed/i.test(event.summary ?? '')
  const color   = stopped ? DarkColors.unpair : DarkColors.online
  return (
    <View style={styles.stopRow}>
      <View style={styles.stopLine} />
      <View style={styles.stopPill}>
        <Ionicons name={stopped ? 'stop-circle' : 'checkmark-done-circle'} size={13} color={color} />
        <Text style={[styles.stopText, { color }]}>{stopped ? 'Stopped' : 'Task complete'}</Text>
        <Text style={[styles.stopTime, { color }]}>
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
// The rotating status word ("Pondering…", "Cooking…") lives ONLY in the compose bar next
// to the Stop button — showing it here too would put the same word on screen twice. So this
// feed indicator is just the animated dots (a typing-indicator), with a static label only
// for the pending-approval case.
function ThinkingBubble({ isPendingApproval }: { isPendingApproval: boolean }) {
  const color = isPendingApproval ? DarkColors.unpair : DarkColors.online
  return (
    <View style={styles.thinkingRow}>
      <View style={styles.thinkingDots}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View style={[styles.dot, { backgroundColor: color, opacity: 0.6 }]} />
        <View style={[styles.dot, { backgroundColor: color, opacity: 0.3 }]} />
      </View>
      {isPendingApproval && (
        <Text style={[styles.thinkingLabel, { color }]}>Waiting for approval…</Text>
      )}
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
  const stopSes = useStopSession()

  const { data: sessions = [] } = useSessions()
  const liveSession    = sessions.find(s => s.session_id === sessionId)
  const liveStatus     = liveSession?.status     ?? status
  const liveOnline     = liveSession?.machine_is_online ?? machineIsOnline
  const cliClosed      = liveSession?.cli_alive === false && liveStatus !== 'active'
  const harnessOff     = liveSession?.harness_enabled === false

  useMachineChannel(liveSession?.machine_id)

  const [prompt, setPrompt] = useState(prefill ?? '')
  const [stopping, setStopping] = useState(false)
  // Optimistic composer state for the user's OWN action, so the bar reacts instantly
  // instead of waiting on the feed/status round-trip:
  //   'sent'    → a prompt was just delivered → lock the composer NOW (no double-send)
  //   'stopped' → Stop was just tapped        → unlock the composer NOW (turn is ending)
  // The feed reconciles the steady state and clears this (see the effect below).
  const [pendingAction, setPendingAction] = useState<null | 'sent' | 'stopped'>(null)
  const pendingTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastIdRef      = useRef<string | undefined>(undefined)  // newest feed id, always current
  const pendingSinceId = useRef<string | undefined>(undefined)  // newest feed id when we armed
  const listRef = useRef<FlatList>(null)

  const isNearBottomRef    = useRef(true)
  const didInitialScroll   = useRef(false)
  const followScheduled    = useRef(false)   // coalesces streaming size-changes into 1 scroll/frame
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

  // Single source of auto-follow. Streaming reasoning grows the content height every frame
  // (each firing onContentSizeChange), so coalesce to at most ONE instant pin per frame via
  // rAF — otherwise the per-event scrollToEnd storm fights maintainVisibleContentPosition and
  // the list bounces. Instant (animated:false) so it never competes with the "Jump to latest"
  // animated scroll. See CHAT_LOADING_AND_NAVIGATION.md §4.
  const followBottom = useCallback(() => {
    if (followScheduled.current) return
    followScheduled.current = true
    requestAnimationFrame(() => {
      followScheduled.current = false
      listRef.current?.scrollToEnd({ animated: false })
    })
  }, [])

  useFocusEffect(useCallback(() => {
    if (route.params.prefill) setPrompt(route.params.prefill)
  }, [route.params.prefill])) // eslint-disable-line react-hooks/exhaustive-deps

  const pendingCount = feed.filter(i => i.kind === 'request' && i.req.status === 'pending').length
  const isActive     = liveStatus === 'active'
  const lastItem     = feed[feed.length - 1]
  const lastId       = lastItem?.id

  // The sessions-status poll (isActive) lags turn boundaries by up to 15s on this
  // self-hosted Supabase: `agents` postgres_changes are silently dropped, so idle/active
  // transitions fall back to the slow poll. The feed, though, streams reliably & instantly
  // over the broadcast channel — so drive the composer off the feed instead.
  //
  // But NOT off the single last row: Claude's Stop hook posts the `stop` event the moment
  // the turn ends, while the desktop transcript tailer flushes the turn's final narrative as
  // an `output` up to ~3s LATER — so the newest row right after a finish is usually that
  // trailing output, not the stop. Keying off the last row alone would then read "still
  // working" and keep the send bar hidden for seconds after the task is actually done.
  //
  // Instead, walk back from the newest row skipping trailing `output`s (late narrative) to
  // the real lifecycle boundary: a `stop` = turn ended; a running tool / sent prompt /
  // pending approval = turn live. A `stop` boundary also overrides a stale `isActive`.
  const feedTurn = useMemo<'ended' | 'active' | null>(() => {
    for (let i = feed.length - 1; i >= 0; i--) {
      const it = feed[i]
      if (it.kind === 'output' || it.kind === 'notify') continue   // not a boundary — skip
      if (it.kind === 'stop')     return 'ended'
      if (it.kind === 'activity') return 'active'
      if (it.kind === 'sent')     return 'active'
      // A pending approval means the turn is live; a decided one is transitional (the
      // approved tool is about to run) — skip it and keep looking for the real boundary.
      if (it.kind === 'request')  { if (it.req.status === 'pending') return 'active'; continue }
    }
    return null
  }, [feed])
  const feedActive = feedTurn === 'ended' ? false : (feedTurn === 'active' || isActive)

  // The user's own latest action wins immediately; the feed is the steady-state backstop.
  // 'stopped' forces the composer open even if a trailing reasoning `output` streams in
  // after the halt (which would otherwise re-lock it); 'sent' forces it closed for the beat
  // between delivery and the agent's first streamed event.
  const turnActive =
    pendingAction === 'stopped' ? false :
    pendingAction === 'sent'    ? true  :
    feedActive
  const showThinking = turnActive

  // Reconcile the optimistic override with the feed, but only against events that arrive
  // AFTER we armed (so a pre-existing `stop` — e.g. the user sending right after "Task
  // complete" — can't instantly cancel the new 'sent' lock):
  //   • 'sent'    → any newer event means the turn is under way; hand back to the feed,
  //                 which now reads active (trailing `sent`/activity item).
  //   • 'stopped' → hold the composer open through trailing reasoning; release only once a
  //                 fresh `stop` event confirms the halt (or the 30s safety timer fires).
  useEffect(() => { lastIdRef.current = lastId }, [lastId])
  useEffect(() => {
    if (!pendingAction) return
    if (lastId === pendingSinceId.current) return           // nothing new since we armed
    if (pendingAction === 'sent' || (pendingAction === 'stopped' && feedTurn === 'ended')) {
      if (pendingTimer.current) clearTimeout(pendingTimer.current)
      setPendingAction(null)
    }
  }, [pendingAction, lastId, feedTurn])

  // Clear the pending timer on unmount.
  useEffect(() => () => { if (pendingTimer.current) clearTimeout(pendingTimer.current) }, [])

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

  // Latch an optimistic composer state, auto-releasing after 30s so a dropped turn-end
  // signal can never wedge the bar permanently — the feed truth takes back over.
  const armPending = useCallback((action: 'sent' | 'stopped') => {
    pendingSinceId.current = lastIdRef.current   // anchor: only reconcile against newer events
    setPendingAction(action)
    if (pendingTimer.current) clearTimeout(pendingTimer.current)
    pendingTimer.current = setTimeout(() => setPendingAction(null), 30_000)
  }, [])

  async function handleSend() {
    const text = prompt.trim()
    if (!text) return
    try {
      await sendPmt.mutateAsync({ prompt: text, sessionId })
      setPrompt('')
      // Delivered → lock the composer immediately so a second prompt can't race in before
      // the agent's first event streams back. The trailing `sent`/activity items keep it
      // locked after this optimistic latch releases.
      armPending('sent')
    } catch (err: any) {
      // The server rejects a prompt sent into a mid-turn session (deriveStatus === 'active').
      // The composer is already gated on turnActive, but state can lag by a beat at the very
      // start of a turn — this catches the race and explains it instead of showing a generic
      // failure. Keep the text so the user can resend once the turn ends. See STOP_AGENT_DESIGN.md.
      if (err?.code === 'session_busy') {
        Alert.alert('Agent is working', 'Wait for the current turn to finish, or tap Stop, before sending a new prompt.')
      } else {
        Alert.alert('Failed to send', err.message ?? 'Please try again')
      }
    }
  }

  // Interrupts the current turn only — the CLI process keeps running, same as
  // pressing Esc yourself. Does NOT close the session. See STOP_AGENT_DESIGN.md.
  async function handleStop() {
    setStopping(true)
    // Unlock the composer immediately on the user's intent — the CLI halts within a beat, but
    // the turn-end feed signal can lag (or a trailing reasoning line can arrive after it), so
    // don't wait on it. If the stop somehow doesn't take, the server's session_busy guard
    // still blocks an actual mid-turn send. Reconciled when the `stop` event lands, or 30s.
    armPending('stopped')
    try {
      await stopSes.mutateAsync(sessionId)
    } catch (err: any) {
      Alert.alert('Failed to stop', err.message ?? 'Please try again')
      setPendingAction(null)   // stop didn't go through — fall back to feed truth
    } finally {
      setTimeout(() => setStopping(false), 4000)
    }
  }

  // Confirm before interrupting — a Stop is easy to hit by accident and throws away the
  // work-in-progress turn.
  function confirmStop() {
    Alert.alert(
      'Stop the agent?',
      'This interrupts the current turn. The CLI keeps running, so you can send a new prompt after.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: handleStop },
      ],
    )
  }

  const dirLabel    = dirName(cwd)
  const workingWord = useSpinnerWord(turnActive)
  const canType     = liveOnline && pendingCount === 0 && !cliClosed && !harnessOff && !turnActive
  const canSend  = prompt.trim().length > 0 && !sendPmt.isPending && canType

  const statusColor = turnActive ? DarkColors.online : liveStatus === 'idle' ? DarkColors.unpair : DarkColors.textTertiary
  const statusLabel = turnActive ? 'Active' : liveStatus === 'idle' ? 'Idle' : 'Finished'

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
              isActive={turnActive}
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
              // Sole auto-follow trigger: pin to the newest content on the initial mount, and
              // afterwards only while the user is near the bottom (scrolled up → leave them be
              // and surface "Jump to latest" instead). followBottom coalesces per frame.
              if (!didInitialScroll.current && feed.length > 0) {
                didInitialScroll.current = true
                followBottom()
              } else if (isNearBottomRef.current) {
                followBottom()
              }
            }}
            windowSize={11}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            // removeClippedSubviews detaches off-screen rows on Android and is a well-known
            // source of rows blanking/flickering — especially with variable heights and the
            // live row growing as it types. Off = stable rendering; windowSize caps memory.
            removeClippedSubviews={false}
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
          ) : turnActive ? (
            <View style={styles.workingRow}>
              <View style={styles.workingStatus}>
                <ActivityIndicator size="small" color={DarkColors.online} />
                <Text style={styles.workingStatusText}>{workingWord}…</Text>
              </View>
              <TouchableOpacity
                style={[styles.stopBtn, stopping && styles.stopBtnDisabled]}
                onPress={confirmStop}
                disabled={stopping || stopSes.isPending}
                activeOpacity={0.8}
              >
                {stopping || stopSes.isPending
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Ionicons name="stop" size={16} color="#FFFFFF" />
                }
                <Text style={styles.stopBtnText}>Stop</Text>
              </TouchableOpacity>
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

  // ── Working / Stop (compose bar — replaces the input row while a turn is active) ──
  workingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.px8,
  },
  workingStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8 },
  workingStatusText: { fontSize: FontSize.label, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans },
  stopBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: DarkColors.danger,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px10,
  },
  stopBtnDisabled: { opacity: 0.6 },
  stopBtnText: { fontSize: FontSize.label, fontWeight: '700', color: '#FFFFFF', fontFamily: FontFamily.googleSans },
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
