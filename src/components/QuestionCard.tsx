import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
} from 'react-native'
import { formatDistanceToNow } from 'date-fns'
import { Colors, Spacing, Radius, FontSize, FontFamily } from '../constants/colors'
import type { PendingRequest, SelectedAnswer } from '../types'

interface Props {
  request:  PendingRequest
  onSubmit: (answers: SelectedAnswer[]) => void
}

// Card shown in the chat feed for a kind='question' request (Claude Code's
// AskUserQuestion). Single-select → radios; multiSelect → checkboxes; an optional
// "Other…" free-text row. Locks to a read-only "Answered" state once submitted.
export function QuestionCard({ request, onSubmit }: Props) {
  const questions = request.question?.questions ?? []
  const answered  = request.status === 'answered'
  const timeAgo   = formatDistanceToNow(new Date(request.created_at), { addSuffix: true })

  // chosen[qIndex] = Set of option indices; custom[qIndex] = free-text "Other"
  const [chosen, setChosen] = useState<Record<number, Set<number>>>({})
  const [custom, setCustom] = useState<Record<number, string>>({})

  function pick(qi: number, oi: number, multi: boolean) {
    setChosen(prev => {
      const set = new Set(multi ? Array.from(prev[qi] ?? []) : [])
      if (set.has(oi)) set.delete(oi)
      else set.add(oi)
      return { ...prev, [qi]: set }
    })
  }

  function submit() {
    const answers: SelectedAnswer[] = questions.map((q, qi) => ({
      question_index: qi,
      selected: Array.from(chosen[qi] ?? []).map(oi => ({ index: oi, label: q.options[oi].label })),
      custom_text: custom[qi]?.trim() || undefined,
    }))
    // Require every question to have a selection or custom text.
    const complete = answers.every(a => a.selected.length > 0 || a.custom_text)
    if (complete) onSubmit(answers)
  }

  const canSubmit = questions.every((q, qi) => (chosen[qi]?.size ?? 0) > 0 || custom[qi]?.trim())

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
          const text = ans.selected.map(s => s.label).join(', ') || ans.custom_text
          return (
            <View key={i} style={styles.block}>
              {q?.header ? <Text style={styles.header}>{q.header}</Text> : null}
              <Text style={styles.question}>{q?.question}</Text>
              <Text style={styles.answeredText}>✓ You chose: {text}</Text>
            </View>
          )
        })}
      </View>
    )
  }

  // ── Interactive ───────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.icon}>❓</Text>
        <Text style={styles.kindLabel}>Claude is asking</Text>
        <Text style={styles.time}>{timeAgo}</Text>
      </View>

      {questions.map((q, qi) => {
        const multi = !!q.multiSelect
        return (
          <View key={qi} style={styles.block}>
            {q.header ? <Text style={styles.header}>{q.header}</Text> : null}
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
                  <Text style={[styles.mark, on && styles.markOn]}>
                    {multi ? (on ? '☑' : '☐') : (on ? '◉' : '○')}
                  </Text>
                  <View style={styles.optBody}>
                    <Text style={styles.optLabel}>{opt.label}</Text>
                    {opt.description ? <Text style={styles.optDesc}>{opt.description}</Text> : null}
                  </View>
                </TouchableOpacity>
              )
            })}

            <TextInput
              style={styles.other}
              placeholder="Other… (type a custom answer)"
              placeholderTextColor={Colors.textTertiary}
              value={custom[qi] ?? ''}
              onChangeText={t => setCustom(p => ({ ...p, [qi]: t }))}
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
        <Text style={styles.submitText}>Submit answer</Text>
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
  headerRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.px8,
  },
  icon:      { fontSize: FontSize.body },
  kindLabel: {
    fontSize:   FontSize.label,
    fontStyle:  'italic',
    color:      Colors.textSecondary,
    fontWeight: '500',
    flex:       1,
  },
  time:      { fontSize: FontSize.metadata, color: Colors.textTertiary },
  block:     { gap: Spacing.px8 },
  header: {
    fontSize:      FontSize.microLabel,
    fontWeight:    '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color:         Colors.textTertiary,
  },
  question: {
    fontSize:   FontSize.cardTitle,
    fontWeight: '500',
    color:      Colors.textPrimary,
  },
  hint: { fontSize: FontSize.metadata, color: Colors.textTertiary },
  option: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.px12,
    padding:       Spacing.px12,
    borderRadius:  Radius.sm,
    borderWidth:   1,
    borderColor:   Colors.borderHairline,
  },
  optionOn: {
    borderColor:     Colors.primary,
    backgroundColor: Colors.primaryLight,
  },
  mark:   { fontSize: 18, color: Colors.textTertiary },
  markOn: { color: Colors.primaryDark },
  optBody:  { flex: 1 },
  optLabel: { fontSize: FontSize.body, fontWeight: '500', color: Colors.textPrimary },
  optDesc:  { fontSize: FontSize.metadata, color: Colors.textTertiary, marginTop: 2 },
  other: {
    borderWidth:       1,
    borderColor:       Colors.borderHairline,
    borderRadius:      Radius.sm,
    paddingHorizontal: Spacing.px12,
    paddingVertical:   Spacing.px8,
    fontSize:          FontSize.body,
    fontFamily:        FontFamily.mono,
    color:             Colors.textPrimary,
  },
  submit: {
    backgroundColor: Colors.primary,
    borderRadius:    Radius.sm,
    padding:         Spacing.px12,
    alignItems:      'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: Colors.white, fontWeight: '600', fontSize: FontSize.label },
  answeredText: {
    fontSize:   FontSize.body,
    color:      Colors.successDark,
    fontWeight: '600',
    marginTop:  Spacing.px4,
  },
})
