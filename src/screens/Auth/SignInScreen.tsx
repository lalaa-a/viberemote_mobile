import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useNavigation } from '@react-navigation/native'
import { useAuth } from '../../hooks/useAuth'
import { GradientBackground } from '../../components/GradientBackground'
import { DarkColors, Spacing, Radius, FontSize, FontFamily } from '../../constants/colors'
import LogoIcon from '../../assets/icons/chats.svg'
import type { AuthStackParamList } from '../../types'

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>

export function SignInScreen() {
  const navigation = useNavigation<Nav>()
  const { signIn } = useAuth()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSignIn() {
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      await signIn(email.trim(), password)
      // RootNavigator re-renders on session change; no explicit navigate needed
    } catch (err: any) {
      Alert.alert('Sign in failed', err.message ?? 'Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading

  return (
    <GradientBackground style={styles.bg}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.logoBox}>
            <LogoIcon width={36} height={36} color={DarkColors.online} />
          </View>
          <Text style={styles.title}>Vibe Remote</Text>
          <Text style={styles.sub}>Sign in to your account</Text>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={DarkColors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={DarkColors.textTertiary}
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
            />

            <TouchableOpacity
              style={[styles.btn, !canSubmit && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color={DarkColors.bg} />
                : <Text style={styles.btnText}>Sign In</Text>
              }
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('SignUp')} activeOpacity={0.7}>
            <Text style={styles.switchText}>
              No account?{' '}
              <Text style={styles.switchLink}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  bg:   { backgroundColor: DarkColors.bg },
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
    backgroundColor: DarkColors.surfaceRaised,
    alignItems:      'center',
    justifyContent:  'center',
    marginBottom:    Spacing.px8,
  },
  title: {
    fontSize:   32,
    fontFamily: FontFamily.bitcount,
    color:      DarkColors.textPrimary,
    lineHeight: 40,
  },
  sub: {
    fontSize:     FontSize.body,
    color:        DarkColors.textSecondary,
    fontFamily:   FontFamily.googleSans,
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
    backgroundColor:   DarkColors.surfaceRaised,
    borderWidth:       1,
    borderColor:       DarkColors.borderMid,
    paddingHorizontal: Spacing.px16,
    fontSize:          FontSize.body,
    color:             DarkColors.textPrimary,
    fontFamily:        FontFamily.googleSans,
  },
  btn: {
    width:           '100%',
    height:          52,
    borderRadius:    Radius.full,
    backgroundColor: DarkColors.online,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       Spacing.px4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: {
    fontSize:   FontSize.body,
    fontWeight: '700',
    color:      DarkColors.bg,
    fontFamily: FontFamily.googleSans,
  },
  switchText: {
    fontSize:   FontSize.body,
    color:      DarkColors.textSecondary,
    fontFamily: FontFamily.googleSans,
    marginTop:  Spacing.px8,
  },
  switchLink: {
    color:      DarkColors.online,
    fontWeight: '600',
  },
})
