import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import { useRoute, useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp, RouteProp } from '@react-navigation/native-stack'
import { useSendPrompt } from '../../hooks/useSessions'
import { Colors, Spacing, Radius, FontSize, Shadow } from '../../constants/colors'
import type { SessionsStackParamList } from '../../types'

type Route = RouteProp<SessionsStackParamList, 'PromptCompose'>
type Nav   = NativeStackNavigationProp<SessionsStackParamList>

export function PromptComposeScreen() {
  const route      = useRoute<Route>()
  const navigation = useNavigation<Nav>()
  const { sessionId, prefill } = route.params

  const [prompt, setPrompt] = useState(prefill ?? '')
  const sendPrompt = useSendPrompt()

  async function handleSend() {
    const text = prompt.trim()
    if (!text) return

    try {
      await sendPrompt.mutateAsync({ prompt: text, sessionId })
      navigation.goBack()
    } catch (err: any) {
      Alert.alert('Failed to send', err.message ?? 'Please try again')
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        <Text style={styles.title}>Send prompt</Text>
        <Text style={styles.subtitle}>
          Delivered when Claude is idle with no pending approvals. Checked every 10 seconds.
        </Text>

        <TextInput
          style={styles.input}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Run the test suite and fix any failures…"
          placeholderTextColor={Colors.textTertiary}
          multiline
          autoFocus
          textAlignVertical="top"
          maxLength={2000}
        />

        <View style={styles.footer}>
          <Text style={styles.charCount}>{prompt.length}/2000</Text>
          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendBtn, !prompt.trim() && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!prompt.trim() || sendPrompt.isPending}
              activeOpacity={0.8}
            >
              {sendPrompt.isPending
                ? <ActivityIndicator size="small" color={Colors.white} />
                : <Text style={styles.sendText}>Send →</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor:         Colors.bgPrimary,
    borderTopLeftRadius:     Radius.xl,
    borderTopRightRadius:    Radius.xl,
    padding:                 Spacing.xl,
    paddingBottom:           Platform.OS === 'ios' ? 40 : Spacing.xl,
    gap:                     Spacing.md,
    ...Shadow.modal,
  },
  handle: {
    width:           40,
    height:          4,
    borderRadius:    Radius.full,
    backgroundColor: Colors.border,
    alignSelf:       'center',
    marginBottom:    Spacing.sm,
  },
  title: {
    fontSize:   FontSize.lg,
    fontWeight: '700',
    color:      Colors.textPrimary,
  },
  subtitle: {
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    lineHeight: 18,
  },
  input: {
    borderWidth:     1,
    borderColor:     Colors.border,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    fontSize:        FontSize.md,
    color:           Colors.textPrimary,
    backgroundColor: Colors.bgSecondary,
    minHeight:       120,
    maxHeight:       240,
    lineHeight:      22,
  },
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  charCount: {
    fontSize:  FontSize.xs,
    color:     Colors.textTertiary,
  },
  buttons: {
    flexDirection: 'row',
    gap:           Spacing.sm,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
    borderRadius:      Radius.md,
    borderWidth:       0.5,
    borderColor:       Colors.border,
  },
  cancelText: {
    fontSize:   FontSize.md,
    color:      Colors.textSecondary,
    fontWeight: '500',
  },
  sendBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical:   Spacing.md,
    borderRadius:      Radius.md,
    backgroundColor:   Colors.primary,
    minWidth:          90,
    alignItems:        'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.bgTertiary,
  },
  sendText: {
    fontSize:   FontSize.md,
    fontWeight: '600',
    color:      Colors.white,
  },
})
