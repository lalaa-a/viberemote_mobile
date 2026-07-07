import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, ScrollView,
} from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { Colors, Spacing, Radius, FontSize, FontFamily } from '../constants/colors'
import type { PendingRequest, SelectedAnswer } from '../types'

interface Props {
  request:  PendingRequest
  onSubmit: (answers: SelectedAnswer[]) => void
}

// Card shown in the chat feed for a kind='question' request (Claude Code's
// AskUserQuestion). Supports every question type:
//   • single-select  → radios
//   • multiSelect     → checkboxes
//   • "Other"         → always-on free-text row
//   • preview options → monospace preview block under each option (side-by-side comparison)
//   • multiple Qs     → a tab strip (one tab per question, ✓ when answered)
// Locks to a read-only "Answered" state once submitted.
export function QuestionCard({ request, onSubmit }: Props) {
  const questions = request.question?.questions ?? []
  const answered  = request.status === 'answered'
  const timeAgo   = formatDistanceToNow(new Date(request.created_at), { addSuffix: true })

  // chosen[qIndex] = Set of option indices; custom[qIndex] = free-text "Other"
  const [chosen, setChosen]   = useState<Record<number, Set<number>>>({})
  const [custom, setCustom]   = useState<Record<number, string>>({})
  const [activeTab, setActive] = useState(0)

  function pick(qi: number, oi: number, multi: boolean) {
    setChosen(prev => {
      const set = new Set(multi ? Array.from(prev[qi] ?? []) : [])
      if (set.has(oi)) set.delete(oi)
      else set.add(oi)
      return { ...prev, [qi]: set }
    })
  }

  const isAnswered = (qi: number) => (chosen[qi]?.size ?? 0) > 0 || !!custom[qi]?.trim()
  const canSubmit  = questions.every((_q, qi) => isAnswered(qi))

  function submit() {
    if (!canSubmit) return
    const answers: SelectedAnswer[] = questions.map((q, qi) => ({
      question_index: qi,
      selected: Array.from(chosen[qi] ?? []).map(oi => ({ index: oi, label: q.options[oi].label })),
      custom_text: custom[qi]?.trim() || undefined,
    }))
    onSubmit(answers)
  }

  // ── Answered (read-only) ──────────────────────────────────────────────────
  if (answered) {
    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.icon}>✅</Text>
          <Text style={styles.kindLabel}>Answered</Text>
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
        {(request.selected_options ?? []).map((ans, i) => {
          const q = questions[ans.question_index] ?? questions[i]
          const labels = ans.selected.map(s => s.label).join(', ')
          const text   = [labels, ans.custom_text].filter(Boolean).join(' · ')
          return (
            <View key={i} style={styles.block}>
              {q?.header ? <Text style={styles.header}>{q.header}</Text> : null}
              <Text style={styles.question}>{q?.question}</Text>
              <Text style={styles.answeredText}>✓ You chose: {text || '—'}</Text>
            </View>
          )
        })}
      </View>
    )
  }

  // ── Interactive ───────────────────────────────────────────────────────────
  const multiQuestion = questions.length > 1
  const visible = multiQuestion ? [questions[activeTab]] : questions
  const visibleIndex = (localIdx: number) => (multiQuestion ? activeTab : localIdx)

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.icon}>❓</Text>
        <Text style={styles.kindLabel}>Claude is asking</Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>

      {/* Tab strip — one tab per question when there's more than one */}
      {multiQuestion ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {questions.map((q, qi) => {
            const on   = qi === activeTab
            const done = isAnswered(qi)
            return (
              <TouchableOpacity
                key={qi}
                style={[styles.tab, on && styles.tabOn]}
                onPress={() => setActive(qi)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                  {done ? '✓ ' : ''}{q.header || `Q${qi + 1}`}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>
      ) : null}

      {visible.map((q, localIdx) => {
        const qi    = visibleIndex(localIdx)
        const multi = !!q.multiSelect
        return (
          <View key={qi} style={styles.block}>
            {multiQuestion ? (
              <Text style={styles.counter}>Question {activeTab + 1} of {questions.length}</Text>
            ) : q.header ? (
              <Text style={styles.header}>{q.header}</Text>
            ) : null}
            <Text style={styles.question}>{q.question}</Text>
            {multi ? <Text style={styles.hint}>Select all that apply</Text> : null}

            {q.options.map((opt, oi) => {
              const on = chosen[qi]?.has(oi)
              return (
                <TouchableOpacity
                  key={oi}
                  style={[styles.option, on && styles.optionOn]}
                  onPress={() => pick(qi, oi, multi)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optHeaderRow}>
                    <Text style={[styles.mark, on && styles.markOn]}>
                      {multi ? (on ? '☑' : '☐') : (on ? '◉' : '○')}
                    </Text>
                    <View style={styles.optBody}>
                      <Text style={styles.optLabel}>{opt.label}</Text>
                      {opt.description ? <Text style={styles.optDesc}>{opt.description}</Text> : null}
                    </View>
                  </View>
                  {/* Preview block (mockups / code / diagrams) rendered monospace */}
                  {opt.preview ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.previewWrap}
                      contentContainerStyle={styles.previewInner}
                    >
                      <Text style={styles.previewText}>{opt.preview}</Text>
                    </ScrollView>
                  ) : null}
                </TouchableOpacity>
              )
            })}

            <TextInput
              style={styles.other}
              placeholder="Other… (type a custom answer)"
              placeholderTextColor={Colors.textTertiary}
              value={custom[qi] ?? ''}
              onChangeText={t => setCustom(p => ({ ...p, [qi]: t }))}
              multiline
            />
          </View>
        )
      })}

      <TouchableOpacity
        style={[styles.submit, !canSubmit && styles.submitDisabled]}
        onPress={submit}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        <Text style={styles.submitText}>
          {canSubmit || !multiQuestion
            ? 'Submit answer'
            : `Answer all ${questions.length} questions`}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.px20,
    marginVertical:   6,
    padding:          Spacing.px20,
    borderRadius:     Radius.md,
    borderWidth:      1,
    borderColor:      Colors.borderHairline,
    backgroundColor:  Colors.bgPrimary,
    gap:              Spacing.px12,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8 },
  icon:      { fontSize: FontSize.body },
  kindLabel: {
    fontSize: FontSize.label, fontStyle: 'italic',
    color: Colors.textSecondary, fontWeight: '500', flex: 1,
  },
  time: { fontSize: FontSize.metadata, color: Colors.textTertiary },

  // tab strip
  tabs: { gap: Spacing.px8, paddingVertical: Spacing.px4 },
  tab: {
    paddingHorizontal: Spacing.px12, paddingVertical: Spacing.px8,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.borderHairline,
  },
  tabOn:     { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  tabText:   { fontSize: FontSize.metadata, color: Colors.textSecondary, fontWeight: '500', maxWidth: 120 },
  tabTextOn: { color: Colors.primaryDark, fontWeight: '700' },

  block:   { gap: Spacing.px8 },
  counter: { fontSize: FontSize.microLabel, fontWeight: '600', color: Colors.primaryDark, letterSpacing: 0.4 },
  header: {
    fontSize: FontSize.microLabel, fontWeight: '600', letterSpacing: 0.6,
    textTransform: 'uppercase', color: Colors.textTertiary,
  },
  question: { fontSize: FontSize.cardTitle, fontWeight: '500', color: Colors.textPrimary },
  hint:     { fontSize: FontSize.metadata, color: Colors.textTertiary },

  option: {
    padding: Spacing.px12, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.borderHairline, gap: Spacing.px8,
  },
  optionOn:     { borderColor: Colors.primary, backgroundColor: Colors.primaryLight },
  optHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px12 },
  mark:   { fontSize: 18, color: Colors.textTertiary },
  markOn: { color: Colors.primaryDark },
  optBody:  { flex: 1 },
  optLabel: { fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary },
  optDesc:  { fontSize: FontSize.metadata, color: Colors.textTertiary, marginTop: 2 },

  // preview
  previewWrap:  { borderRadius: Radius.sm, backgroundColor: Colors.bgSecondary, marginTop: Spacing.px4 },
  previewInner: { padding: Spacing.px8 },
  previewText:  { fontFamily: FontFamily.mono, fontSize: FontSize.metadata, color: Colors.textSecondary },

  other: {
    borderWidth: 1, borderColor: Colors.borderHairline, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.px12, paddingVertical: Spacing.px8,
    fontSize: FontSize.body, fontFamily: FontFamily.mono, color: Colors.textPrimary,
  },
  submit: {
    backgroundColor: Colors.primary, borderRadius: Radius.sm,
    padding: Spacing.px12, alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: Colors.white, fontWeight: '600', fontSize: FontSize.label },
  answeredText: {
    fontSize: FontSize.body, color: Colors.successDark, fontWeight: '600', marginTop: Spacing.px4,
  },
})
