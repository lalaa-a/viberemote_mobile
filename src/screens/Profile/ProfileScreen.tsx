import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  StatusBar, Alert, ActivityIndicator, TextInput, Linking, Platform,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { useAuth } from '../../hooks/useAuth'
import { fetchProfile, updateProfile } from '../../api/server'
import type { ProfileStackParamList } from '../../types'
import { GradientBackground } from '../../components/GradientBackground'
import { DarkColors, Spacing, Radius, FontSize, FontFamily, TAB_BOTTOM_INSET } from '../../constants/colors'

const APP_VERSION   = '1.0.0'
const SUPPORT_EMAIL = 'support@vibe-remote.app' // TODO: replace with the real support address

// ── Reusable setting row ──────────────────────────────────────────────────────
// Icons match the bottom-nav style: a plain monochrome white stroke, no per-row accent
// colour and no tinted chip behind them. `tint` is accepted but intentionally ignored so
// existing call sites keep working. (`danger` still tints the label, not the icon.)
function SettingRow({ icon, label, value, onPress, danger, last }: {
  icon: string; tint?: string; label: string; value?: string
  onPress?: () => void; danger?: boolean; last?: boolean
}) {
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={24} color={DarkColors.tabActive} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: DarkColors.danger }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress && !value && <Ionicons name="chevron-forward" size={18} color={DarkColors.textTertiary} />}
    </TouchableOpacity>
  )
}

export function ProfileScreen() {
  const insets      = useSafeAreaInsets()
  const { signOut } = useAuth()
  const queryClient = useQueryClient()
  const navigation  = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>()

  const { data: profile, isLoading } = useQuery({ queryKey: ['profile'], queryFn: fetchProfile })

  const [editName, setEditName] = useState<string | null>(null)

  const updateMut = useMutation({
    mutationFn: (patch: { display_name?: string }) => updateProfile(patch),
    onSuccess:  () => { queryClient.invalidateQueries({ queryKey: ['profile'] }); setEditName(null) },
    onError:    (e: any) => Alert.alert('Error', e.message),
  })

  function handleSignOut() {
    Alert.alert('Log out', 'Log out of Vibe Remote?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: signOut },
    ])
  }

  function handleNotifications() {
    Alert.alert(
      'Notifications',
      'Manage push notification permissions for Vibe Remote in your device settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]
    )
  }

  function handleTheme() {
    Alert.alert('Theme', 'Vibe Remote currently uses a Dark theme. More theme options are coming soon.')
  }

  function handleAbout() {
    Alert.alert(
      'Vibe Remote',
      `Version ${APP_VERSION}\n\nControl and approve your AI coding agents from anywhere — review tool calls, answer questions, and send prompts on the go.`
    )
  }

  function handleBugReport() {
    const subject = encodeURIComponent('Vibe Remote — Bug report')
    const body = encodeURIComponent(
      `\n\n---\nApp version: ${APP_VERSION}\nPlatform: ${Platform.OS} ${Platform.Version}\nAccount: ${profile?.email ?? 'unknown'}`
    )
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`)
      .catch(() => Alert.alert('No mail app', `Send your report to ${SUPPORT_EMAIL}`))
  }

  const displayName = profile?.display_name?.trim() || 'Set your name'
  const initial     = (profile?.display_name?.trim() || profile?.email || '?').charAt(0).toUpperCase()

  return (
    <GradientBackground style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.appName}>settings</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={DarkColors.online} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: TAB_BOTTOM_INSET }]} showsVerticalScrollIndicator={false}>

          {/* ── Profile card ── */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>

            {editName !== null ? (
              <View style={styles.profileEdit}>
                <TextInput
                  style={styles.nameInput}
                  value={editName}
                  onChangeText={setEditName}
                  autoFocus
                  placeholder="Your name"
                  placeholderTextColor={DarkColors.textTertiary}
                />
                <View style={styles.editBtns}>
                  <TouchableOpacity onPress={() => setEditName(null)} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => updateMut.mutate({ display_name: editName.trim() })}
                    disabled={updateMut.isPending || !editName.trim()}
                    style={[styles.saveBtn, (!editName.trim() || updateMut.isPending) && { opacity: 0.5 }]}
                  >
                    {updateMut.isPending
                      ? <ActivityIndicator size="small" color={DarkColors.bg} />
                      : <Text style={styles.saveBtnText}>Save</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
                  <Text style={styles.profileEmail} numberOfLines={1}>{profile?.email ?? '—'}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setEditName(profile?.display_name ?? '')}
                  style={styles.editIcon}
                  hitSlop={8}
                >
                  <Ionicons name="pencil" size={16} color={DarkColors.textPrimary} />
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* ── Security & privacy ── */}
          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <View style={styles.group}>
            <SettingRow
              icon="shield-checkmark-outline" tint={DarkColors.online}
              label="Security & privacy"
              onPress={() => navigation.navigate('Security')}
              last
            />
          </View>

          {/* ── Preferences ── */}
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <View style={styles.group}>
            <SettingRow icon="notifications-outline" tint={DarkColors.unpair} label="Notifications" onPress={handleNotifications} />
            <SettingRow icon="color-palette-outline" tint="#B79CE6" label="Theme" value="Dark" onPress={handleTheme} last />
          </View>

          {/* ── Support ── */}
          <Text style={styles.sectionLabel}>SUPPORT</Text>
          <View style={styles.group}>
            <SettingRow icon="information-circle-outline" tint={DarkColors.badgeBg} label="About us" onPress={handleAbout} />
            <SettingRow icon="bug-outline" tint={DarkColors.danger} label="Send bug report" onPress={handleBugReport} last />
          </View>

          {/* ── Log out ── */}
          <View style={styles.group}>
            <SettingRow icon="log-out-outline" label="Log out" danger onPress={handleSignOut} last />
          </View>

          <Text style={styles.version}>Vibe Remote · v{APP_VERSION}</Text>

        </ScrollView>
      )}
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  root:    { backgroundColor: DarkColors.bg },
  header:  { paddingHorizontal: Spacing.px20, paddingBottom: Spacing.px16 },
  appName: { fontSize: 28, fontFamily: FontFamily.bitcount, color: DarkColors.textPrimary, lineHeight: 34 },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:    { paddingHorizontal: Spacing.px20, paddingTop: Spacing.px4, gap: Spacing.px10 },

  // Profile card
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.px12,
    backgroundColor: DarkColors.surface, borderRadius: Radius.lg, padding: Spacing.px16,
    marginBottom: Spacing.px6,
  },
  avatar: {
    width: 56, height: 56, borderRadius: Radius.full, backgroundColor: DarkColors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: FontSize.displayM, fontWeight: '700', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans },
  profileInfo:  { flex: 1, gap: 2 },
  profileName:  { fontSize: FontSize.cardTitle, fontWeight: '700', color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans },
  profileEmail: { fontSize: FontSize.metadata, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans },
  editIcon: {
    width: 36, height: 36, borderRadius: Radius.full, backgroundColor: DarkColors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  profileEdit: { flex: 1, gap: Spacing.px8 },
  nameInput: {
    height: 40, borderRadius: Radius.sm, backgroundColor: DarkColors.surfaceRaised,
    borderWidth: 1, borderColor: DarkColors.borderMid,
    paddingHorizontal: Spacing.px12, fontSize: FontSize.body, color: DarkColors.textPrimary,
    fontFamily: FontFamily.googleSans,
  },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.px8 },

  // Section
  sectionLabel: {
    fontSize: FontSize.microLabel, fontWeight: '700', color: DarkColors.textTertiary,
    letterSpacing: 0.6, marginTop: Spacing.px8, marginBottom: Spacing.px2, paddingHorizontal: Spacing.px4,
  },
  group: {
    backgroundColor: DarkColors.surface, borderRadius: Radius.lg, overflow: 'hidden',
  },

  // Row
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.px12, paddingHorizontal: Spacing.px16, paddingVertical: Spacing.px10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: DarkColors.border },
  rowIcon: { width: 30, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowLabel: { flex: 1, fontSize: FontSize.body, color: DarkColors.textPrimary, fontFamily: FontFamily.googleSans, fontWeight: '500' },
  rowValue: { fontSize: FontSize.label, color: DarkColors.textTertiary, fontFamily: FontFamily.googleSans },

  // Buttons
  saveBtn: {
    paddingHorizontal: Spacing.px16, height: 44, borderRadius: Radius.full,
    backgroundColor: DarkColors.online, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnText: { fontSize: FontSize.label, fontWeight: '700', color: DarkColors.bg, fontFamily: FontFamily.googleSans },
  cancelBtn: { paddingHorizontal: Spacing.px16, height: 44, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: DarkColors.surfaceRaised },
  cancelBtnText: { fontSize: FontSize.label, color: DarkColors.textSecondary, fontFamily: FontFamily.googleSans, fontWeight: '600' },

  version: { fontSize: FontSize.metadata, color: DarkColors.textTertiary, textAlign: 'center', marginTop: Spacing.px12, fontFamily: FontFamily.googleSans },
})
