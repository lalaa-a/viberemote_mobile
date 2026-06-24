import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../hooks/useAuth'
import { GradientBackground } from '../../components/GradientBackground'
import { Colors, Spacing, Radius, FontSize, FontFamily, Shadow } from '../../constants/colors'
import type { AuthStackParamList } from '../../types'

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignUp'>

export function SignUpScreen() {
  const navigation = useNavigation<Nav>()
  const { signUp } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)

  async function handleSignUp() {
    if (!email.trim() || !password) return
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.')
      return
    }
    setLoading(true)
    try {
      await signUp(email.trim(), password)
      setSent(true)
    } catch (err: any) {
      Alert.alert('Sign up failed', err.message ?? 'Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <GradientBackground>
        <View style={styles.root}>
          <View style={styles.content}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.sub}>
              We sent a confirmation link to {email}.{'\n'}
              Click it and then sign in.
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')} style={styles.btn} activeOpacity={0.8}>
              <Text style={styles.btnText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.logoBox}>
            <Text style={styles.logoInitials}>VR</Text>
          </View>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.sub}>Start using Vibe Remote</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 chars)"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSignUp}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignUp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color={Colors.textInverse} />
                : <Text style={styles.btnText}>Create Account</Text>
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('SignIn')} activeOpacity={0.7}>
            <Text style={styles.switchText}>
              Already have an account?{' '}
              <Text style={styles.switchLink}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: Spacing.px32,
    gap:               Spacing.px12,
  },
  logoBox: {
    width:           64,
    height:          64,
    borderRadius:    Radius.lg,
    backgroundColor: Colors.accentLight,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Spacing.px8,
  },
  logoInitials: {
    fontSize:      18,
    fontWeight:    '700',
    fontFamily:    FontFamily.serifBold,
    color:         Colors.accentDeep,
    letterSpacing: 1,
  },
  title: {
    fontSize:      FontSize.displayM,
    fontWeight:    '700',
    fontFamily:    FontFamily.serifBold,
    color:         Colors.textPrimary,
    letterSpacing: -0.4,
    textAlign:     'center',
  },
  sub: {
    fontSize:   FontSize.body,
    color:      Colors.textSecondary,
    textAlign:  'center',
    lineHeight: 22,
    maxWidth:   280,
    marginBottom: Spacing.px8,
  },
  form: {
    width: '100%',
    gap:   Spacing.px12,
  },
  input: {
    width:             '100%',
    height:            52,
    borderRadius:      Radius.md,
    backgroundColor:   Colors.bgPrimary,
    borderWidth:       1,
    borderColor:       Colors.borderHairline,
    paddingHorizontal: Spacing.px16,
    fontSize:          FontSize.body,
    color:             Colors.textPrimary,
  },
  btn: {
    width:           '100%',
    height:          52,
    borderRadius:    Radius.full,
    backgroundColor: Colors.inkBlack,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       Spacing.px4,
    ...Shadow.inkPill,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: {
    fontSize:   FontSize.body,
    fontWeight: '600',
    color:      Colors.textInverse,
  },
  switchText: {
    fontSize:  FontSize.body,
    color:     Colors.textSecondary,
    marginTop: Spacing.px8,
  },
  switchLink: {
    color:      Colors.accentDeep,
    fontWeight: '600',
  },
})
