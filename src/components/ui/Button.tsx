import React from 'react'
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native'
import type { ViewStyle } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { DarkColors, Radius, FontSize, FontFamily } from '../../constants/colors'

export type ButtonVariant = 'primary' | 'success' | 'destructive' | 'secondary'
export type ButtonSize    = 'md' | 'sm'

const VARIANTS: Record<ButtonVariant, { bg: string; text: string }> = {
  primary:     { bg: DarkColors.badgeBg,       text: '#FFFFFF' },
  success:     { bg: DarkColors.approve,        text: DarkColors.bg },
  destructive: { bg: DarkColors.danger,         text: '#FFFFFF' },
  secondary:   { bg: DarkColors.surfaceRaised,  text: DarkColors.textPrimary },
}

const SIZES: Record<ButtonSize, { height: number; font: number }> = {
  md: { height: 52, font: FontSize.body },
  sm: { height: 44, font: FontSize.label },
}

interface Props {
  variant?:  ButtonVariant
  size?:     ButtonSize
  icon?:     string
  onPress?:  () => void
  disabled?: boolean
  loading?:  boolean
  children:  React.ReactNode
  style?:    ViewStyle
}

// shadcn-style Button, implemented in the project's StyleSheet + DarkColors system.
export function Button({
  variant = 'primary', size = 'md', icon, onPress, disabled, loading, children, style,
}: Props) {
  const v = VARIANTS[variant]
  const s = SIZES[size]
  return (
    <TouchableOpacity
      style={[styles.btn, { backgroundColor: v.bg, height: s.height }, (disabled || loading) && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <View style={styles.inner}>
          {icon ? <Ionicons name={icon} size={16} color={v.text} /> : null}
          <Text style={[styles.text, { color: v.text, fontSize: s.font }]}>{children}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn:      { borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  inner:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  disabled: { opacity: 0.5 },
  text:     { fontWeight: '700', fontFamily: FontFamily.googleSans },
})
