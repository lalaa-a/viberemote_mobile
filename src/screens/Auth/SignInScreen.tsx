import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  Alert, ActivityIndicator, StatusBar,
} from 'react-native'
import { useAuth } from '../../hooks/useAuth'
import { Colors, Spacing, Radius, FontSize } from '../../constants/colors'

export function SignInScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const { signIn } = useAuth()

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    try {
      await signIn(email.trim().toLowerCase(), password)
      // Navigation handled by RootNavigator session listener
    } catch (err: any) {
      Alert.alert('Sign in failed', err.message ?? 'Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.outer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgPrimary} />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>AC</Text>
          </View>
          <Text style={styles.title}>Agent Control</Text>
          <Text style={styles.subtitle}>
            Review and approve Claude Code requests from your phone
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              textContentType="password"
              onSubmitEditing={handleSignIn}
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonLoading]}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={Colors.white} />
              : <Text style={styles.buttonText}>Sign in</Text>
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>
          Use the same account you used when running setup.js on your machine.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex:            1,
    backgroundColor: Colors.bgPrimary,
  },
  container: {
    flex:            1,
    padding:         Spacing.xxl,
    justifyContent:  'center',
  },
  header: {
    alignItems:    'center',
    marginBottom:  Spacing.xxxl,
  },
  logoBox: {
    width:           56,
    height:          56,
    borderRadius:    Radius.lg,
    backgroundColor: Colors.primary,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Spacing.lg,
  },
  logoText: {
    fontSize:   20,
    fontWeight: '700',
    color:      Colors.white,
  },
  title: {
    fontSize:     FontSize.xxl,
    fontWeight:   '700',
    color:        Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize:   FontSize.sm,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
  form: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  label: {
    fontSize:   FontSize.sm,
    fontWeight: '500',
    color:      Colors.textSecondary,
  },
  input: {
    borderWidth:   1,
    borderColor:   Colors.border,
    borderRadius:  Radius.md,
    padding:       Spacing.md,
    fontSize:      FontSize.md,
    color:         Colors.textPrimary,
    backgroundColor: Colors.bgPrimary,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius:    Radius.md,
    padding:         Spacing.lg,
    alignItems:      'center',
    marginTop:       Spacing.sm,
  },
  buttonLoading: {
    opacity: 0.7,
  },
  buttonText: {
    color:      Colors.white,
    fontSize:   FontSize.md,
    fontWeight: '600',
  },
  hint: {
    fontSize:   FontSize.xs,
    color:      Colors.textTertiary,
    textAlign:  'center',
    marginTop:  Spacing.xxl,
    lineHeight: 18,
  },
})
