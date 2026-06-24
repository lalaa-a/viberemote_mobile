import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, TextInput,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useAuth } from '../../hooks/useAuth'
import { fetchProfile, updateProfile, changePassword, deleteAccount } from '../../api/server'
import { GradientBackground } from '../../components/GradientBackground'
import { Colors, Spacing, Radius, FontSize, FontFamily, TAB_BOTTOM_INSET } from '../../constants/colors'

export function ProfileScreen() {
  const insets     = useSafeAreaInsets()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn:  fetchProfile,
  })

  const [editName, setEditName]   = useState<string | null>(null)
  const [newPwd,   setNewPwd]     = useState('')
  const [showPwd,  setShowPwd]    = useState(false)

  const updateMut = useMutation({
    mutationFn: (patch: { display_name?: string }) => updateProfile(patch),
    onSuccess:  () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      setEditName(null)
    },
  })

  const pwdMut = useMutation({
    mutationFn: (pwd: string) => changePassword(pwd),
    onSuccess:  () => {
      setNewPwd('')
      setShowPwd(false)
      Alert.alert('Password changed', 'Your password has been updated.')
    },
    onError: (e: any) => Alert.alert('Error', e.message),
  })

  const deleteMut = useMutation({
    mutationFn: deleteAccount,
    onSuccess:  () => signOut(),
    onError:    (e: any) => Alert.alert('Error', e.message),
  })

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently removes your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate() },
      ]
    )
  }

  function handleSignOut() {
    Alert.alert('Sign out', 'Sign out of Vibe Remote?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: signOut },
    ])
  }

  return (
    <GradientBackground>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.appName}>Vibe Remote</Text>
          <Text style={styles.title}>Profile</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: TAB_BOTTOM_INSET }]}>

          {/* ── Identity ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.fieldValue}>{profile?.email ?? '—'}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Display name</Text>
              {editName !== null ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={editName}
                    onChangeText={setEditName}
                    autoFocus
                    placeholder="Your name"
                    placeholderTextColor={Colors.textTertiary}
                  />
                  <TouchableOpacity
                    onPress={() => updateMut.mutate({ display_name: editName })}
                    disabled={updateMut.isPending}
                    style={styles.saveBtn}
                  >
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditName(null)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.editRow}>
                  <Text style={styles.fieldValue}>{profile?.display_name ?? 'Not set'}</Text>
                  <TouchableOpacity onPress={() => setEditName(profile?.display_name ?? '')}>
                    <Ionicons name="pencil-outline" size={18} color={Colors.accent} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* ── Security ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SECURITY</Text>
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Change password</Text>
              {showPwd ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={[styles.editInput, { flex: 1 }]}
                    value={newPwd}
                    onChangeText={setNewPwd}
                    placeholder="New password (min 6 chars)"
                    placeholderTextColor={Colors.textTertiary}
                    secureTextEntry
                    autoFocus
                  />
                  <TouchableOpacity
                    onPress={() => newPwd.length >= 6 && pwdMut.mutate(newPwd)}
                    disabled={pwdMut.isPending || newPwd.length < 6}
                    style={styles.saveBtn}
                  >
                    <Text style={styles.saveBtnText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setShowPwd(false); setNewPwd('') }} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setShowPwd(true)}>
                  <Text style={styles.linkText}>Change password</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Actions ── */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.actionRow} onPress={handleSignOut} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color={Colors.textPrimary} />
              <Text style={styles.actionText}>Sign Out</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionRow, styles.dangerRow]} onPress={handleDeleteAccount} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={20} color={Colors.danger} />
              <Text style={[styles.actionText, { color: Colors.danger }]}>Delete Account</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.danger} />
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: Spacing.px20,
    paddingBottom:     Spacing.px16,
  },
  appName: { fontSize: 28, fontFamily: FontFamily.serifItalic, color: Colors.textPrimary, lineHeight: 32 },
  title:   { fontSize: FontSize.cardTitle, fontFamily: FontFamily.loraItalic, fontWeight: '500', color: Colors.textTertiary, letterSpacing: 0.3 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:    { paddingHorizontal: Spacing.px20, paddingTop: Spacing.px4, gap: Spacing.px4 },
  section: { gap: Spacing.px2, marginBottom: Spacing.px16 },
  sectionLabel: {
    fontSize: FontSize.microLabel, fontWeight: '700', color: Colors.textTertiary,
    letterSpacing: 0.6, marginBottom: Spacing.px4, paddingHorizontal: Spacing.px4,
  },
  card: {
    backgroundColor: Colors.bgPrimary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px14,
    borderWidth: 1, borderColor: Colors.borderHairline, gap: Spacing.px4,
  },
  fieldLabel: { fontSize: FontSize.metadata, color: Colors.textTertiary, fontWeight: '500' },
  fieldValue: { fontSize: FontSize.body, color: Colors.textPrimary },
  editRow:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.px8, marginTop: Spacing.px4 },
  editInput:  {
    flex: 1, height: 36, borderRadius: Radius.sm, backgroundColor: Colors.surfaceGlassStrong,
    borderWidth: 1, borderColor: Colors.borderHairline,
    paddingHorizontal: Spacing.px10, fontSize: FontSize.body, color: Colors.textPrimary,
  },
  saveBtn:      { paddingHorizontal: Spacing.px10, paddingVertical: Spacing.px6, borderRadius: Radius.sm, backgroundColor: Colors.accentDeep },
  saveBtnText:  { fontSize: FontSize.label, fontWeight: '600', color: '#fff' },
  cancelBtn:    { paddingHorizontal: Spacing.px8, paddingVertical: Spacing.px6 },
  cancelBtnText:{ fontSize: FontSize.label, color: Colors.textTertiary },
  linkText:     { fontSize: FontSize.body, color: Colors.accentDeep, fontWeight: '500', marginTop: Spacing.px4 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px12,
    backgroundColor: Colors.bgPrimary, paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px14,
    borderWidth: 1, borderColor: Colors.borderHairline, borderRadius: Radius.md, marginBottom: Spacing.px2,
  },
  dangerRow:  { borderColor: Colors.danger + '30' },
  actionText: { flex: 1, fontSize: FontSize.body, color: Colors.textPrimary, fontWeight: '500' },
})
