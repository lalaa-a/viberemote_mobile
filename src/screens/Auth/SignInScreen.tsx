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
          <Text style={styles.title}>Vibe Remote</Text>
          <Text style={styles.sub}>Sign in to your account</Text>

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
              placeholder="Password"
              placeholderTextColor={Colors.textTertiary}
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleSignIn}
            />

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator size="small" color={Colors.textInverse} />
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
  },
  sub: {
    fontSize:     FontSize.body,
    color:        Colors.textSecondary,
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
