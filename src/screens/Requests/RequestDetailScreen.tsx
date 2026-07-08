import React from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  Alert, ActivityIndicator, StatusBar, Platform,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { RouteProp } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { formatDistanceToNow } from 'date-fns'
import { useRequest, useDecideRequest, useAnswerRequest } from '../../hooks/useRequests'
import { DiffViewer } from '../../components/DiffViewer/DiffViewer'
import { QuestionCard } from '../../components/QuestionCard'
import { GradientBackground } from '../../components/GradientBackground'
import { BackButton } from '../../components/ui/BackButton'
import { Button } from '../../components/ui/Button'
import { Badge, RISK_VARIANT } from '../../components/ui/Badge'
import { Card, CardStrip } from '../../components/ui/Card'
import { DarkColors, Spacing, Radius, FontSize, FontFamily } from '../../constants/colors'
import { useAppStore } from '../../store/useAppStore'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import type { SessionsStackParamList, SelectedAnswer } from '../../types'

type Route = RouteProp<SessionsStackParamList, 'RequestDetail'>
type Nav   = NativeStackNavigationProp<SessionsStackParamList>

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace'

function lastPathPart(p?: string | null): string {
  if (!p) return ''
  return p.split(/[\\/]/).filter(Boolean).pop() ?? p
}

export function RequestDetailScreen() {
  const route      = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { id }     = route.params

  const { data: request, isLoading } = useRequest(id)
  const decide    = useDecideRequest()
  const answer    = useAnswerRequest()
  const showToast = useAppStore(s => s.showToast)
  const insets    = useSafeAreaInsets()

  async function handleAnswer(answers: SelectedAnswer[]) {
    if (!request) return
    try {
      await answer.mutateAsync({ id, answers })
      showToast('Answer sent', 'success')
      navigation.goBack()
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to send answer')
    }
  }

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
      <GradientBackground style={styles.root}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DarkColors.online} />
        </View>
      </GradientBackground>
    )
  }

  const dirLabel = lastPathPart(request.file_path ?? request.files_affected?.[0]) || (request.machines?.label ?? 'request')

  // ── Top navigation: back button + directory pill (no page title) ──
  const Header = (
    <View style={[styles.backRow, { paddingTop: insets.top + 12 }]}>
      <BackButton />
      <View style={styles.dirPill}>
        <Text style={styles.dirText} numberOfLines={1}>{dirLabel}</Text>
      </View>
    </View>
  )

  // ── Question requests keep the QuestionCard picker ──
  if (request.kind === 'question') {
    return (
      <GradientBackground style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        {Header}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <QuestionCard request={request} onSubmit={handleAnswer} />
        </ScrollView>
      </GradientBackground>
    )
  }

  const alreadyDecided = request.status !== 'pending'
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true })

  return (
    <GradientBackground style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {Header}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header card ── */}
        <Card>
          <CardStrip>
            <Text style={styles.toolName} numberOfLines={1}>{request.tool_name}</Text>
            <Badge variant={RISK_VARIANT[request.risk_level] ?? 'neutral'}>
              {request.risk_level}
            </Badge>
          </CardStrip>

          <Text style={styles.summary}>{request.summary}</Text>

          {/* Icon row — machine · risk · time */}
          <View style={styles.iconRow}>
            <View style={styles.iconItem}>
              <Ionicons name="desktop-outline" size={22} color={DarkColors.textPrimary} />
              <View style={[styles.iconDot, { backgroundColor: request.machines?.is_online ? DarkColors.online : DarkColors.textTertiary }]} />
              <Text style={styles.iconLabel} numberOfLines={1}>{request.machines?.label ?? 'Unknown'}</Text>
            </View>
            <View style={styles.iconItem}>
              <Ionicons name="shield-outline" size={22} color={DarkColors.textPrimary} />
              <Text style={styles.iconLabel} numberOfLines={1}>{request.risk_level}</Text>
            </View>
            <View style={styles.iconItem}>
              <Ionicons name="time-outline" size={22} color={DarkColors.textPrimary} />
              <Text style={styles.iconLabel} numberOfLines={1}>{timeAgo}</Text>
            </View>
          </View>
        </Card>

        {/* ── Bash command ── */}
        {request.command && (
          <Card>
            <Text style={styles.sectionLabel}>BASH COMMAND</Text>
            <View style={styles.codeBlock}>
              <Text style={styles.dollarSign}>$</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                <Text style={styles.commandText} selectable>{request.command}</Text>
              </ScrollView>
            </View>
          </Card>
        )}

        {/* ── Files ── */}
        {request.files_affected?.length > 0 && (
          <Card>
            <Text style={styles.sectionLabel}>FILES · {request.files_affected.length}</Text>
            {request.files_affected.map((f, i) => (
              <View key={i} style={styles.fileRow}>
                <Ionicons name="document-outline" size={14} color={DarkColors.textTertiary} />
                <Text style={styles.filePath} selectable numberOfLines={1}>{f}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── Diff ── */}
        {request.diff && (
          <Card>
            <Text style={styles.sectionLabel}>
              CHANGES · +{request.diff.grand_stats?.added ?? request.diff.stats?.added ?? 0}
              {'  '}−{request.diff.grand_stats?.removed ?? request.diff.stats?.removed ?? 0}
            </Text>
            <DiffViewer diff={request.diff} />
          </Card>
        )}

        {/* ── Decision banner ── */}
        {alreadyDecided && (
          <Card style={styles.decidedBanner}>
            <Ionicons
              name={request.status === 'approved' ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={request.status === 'approved' ? DarkColors.online : DarkColors.danger}
            />
            <Text style={[
              styles.decidedText,
              { color: request.status === 'approved' ? DarkColors.online : DarkColors.danger },
            ]}>
              {request.status === 'approved' ? 'Approved' : 'Denied'}
              {request.decided_by ? ` via ${request.decided_by}` : ''}
            </Text>
          </Card>
        )}

        <View style={{ height: 150 }} />
      </ScrollView>

      {/* ── Sticky footer ── */}
      {!alreadyDecided && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Button variant="destructive" style={styles.footerBtn} onPress={() => handleDecide('denied')} disabled={decide.isPending}>
            Deny
          </Button>
          <Button variant="success" style={styles.footerBtn} loading={decide.isPending} onPress={() => handleDecide('approved')}>
            Approve
          </Button>
        </View>
      )}
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  root:   { backgroundColor: DarkColors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Back row: circular button + directory pill
  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px10,
    paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px8,
  },
  dirPill: {
    flex: 1, height: 48, justifyContent: 'center',
    paddingHorizontal: Spacing.px16, borderRadius: Radius.full,
    backgroundColor: DarkColors.surfaceRaised,
  },
  dirText: { fontSize: FontSize.body, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, fontWeight: '500' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.px20, paddingTop: Spacing.px4, gap: Spacing.px16 },

  toolName: { fontSize: FontSize.cardTitle, fontWeight: '700', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, flex: 1 },
  summary:  { fontSize: FontSize.body, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, lineHeight: 22, paddingHorizontal: Spacing.px4 },

  // Icon row
  iconRow:  { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', paddingVertical: Spacing.px8 },
  iconItem: { alignItems: 'center', gap: 4, flex: 1 },
  iconDot:  { width: 6, height: 6, borderRadius: Radius.full, position: 'absolute', top: 0, right: '32%' },
  iconLabel:{ fontSize: FontSize.metadata, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans, maxWidth: 100, textAlign: 'center' },

  sectionLabel: {
    fontSize: FontSize.microLabel, fontWeight: '700', color: DarkColors.textSecondary,
    letterSpacing: 0.6, textTransform: 'uppercase', fontFamily: FontFamily.googleSans,
  },

  // Code block
  codeBlock: {
    flexDirection: 'row', backgroundColor: DarkColors.bg, borderRadius: Radius.md,
    padding: Spacing.px16, gap: Spacing.px8, alignItems: 'flex-start',
  },
  dollarSign:  { fontFamily: MONO, fontSize: FontSize.monoSmall, color: DarkColors.online, lineHeight: 20, marginTop: 1 },
  commandText: { fontFamily: MONO, fontSize: FontSize.monoSmall, color: DarkColors.textPrimary, lineHeight: 20 },

  // Files
  fileRow:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, paddingVertical: 2 },
  filePath: { fontFamily: MONO, fontSize: FontSize.monoSmall, color: DarkColors.textSecondary, flex: 1 },

  // Decision banner
  decidedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.px8 },
  decidedText:   { fontSize: FontSize.label, fontWeight: '700', fontFamily: FontFamily.googleSans },

  // Sticky footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: Spacing.px12,
    paddingHorizontal: Spacing.px20, paddingTop: Spacing.px16,
    backgroundColor: DarkColors.surface,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
  },
  footerBtn: { flex: 1 },
})
