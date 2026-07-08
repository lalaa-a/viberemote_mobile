import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { DarkColors, Radius, FontSize, FontFamily } from '../../constants/colors'
import type { RiskLevel } from '../../types'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'critical' | 'neutral'

const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  success:  { bg: DarkColors.online,        text: DarkColors.bg },
  warning:  { bg: DarkColors.unpair,        text: DarkColors.bg },
  danger:   { bg: DarkColors.danger,        text: '#FFFFFF' },
  critical: { bg: DarkColors.dangerDeep,    text: '#FFFFFF' },
  neutral:  { bg: DarkColors.surfaceRaised, text: DarkColors.textSecondary },
}

// Maps a request risk level onto a badge variant.
export const RISK_VARIANT: Record<RiskLevel, BadgeVariant> = {
  low:      'success',
  medium:   'warning',
  high:     'danger',
  critical: 'critical',
}

interface Props {
  variant?: BadgeVariant
  children: React.ReactNode
  style?:   ViewStyle
}

export function Badge({ variant = 'neutral', children, style }: Props) {
  const v = VARIANTS[variant]
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{children}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: Radius.full, alignSelf: 'flex-start',
  },
  text: { fontSize: FontSize.label, fontWeight: '700', fontFamily: FontFamily.googleSans },
})
