import React from 'react'
import { View, StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { DarkColors, Radius, Spacing } from '../../constants/colors'

interface Props {
  children: React.ReactNode
  style?:   ViewStyle
}

// Surface card (#143753). Use `Card` for the main surface and `CardStrip`
// for the raised (#164269) header strip inside it.
export function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function CardStrip({ children, style }: Props) {
  return <View style={[styles.strip, style]}>{children}</View>
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: DarkColors.surface,
    borderRadius:    Radius.lg,
    padding:         Spacing.px12,
    gap:             Spacing.px10,
  },
  strip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.px8,
    backgroundColor: DarkColors.surfaceRaised,
    borderRadius:    Radius.md,
    paddingHorizontal: Spacing.px12,
    paddingVertical:   Spacing.px10,
  },
})
