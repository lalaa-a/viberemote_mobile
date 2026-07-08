import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { DarkColors, Radius, FontFamily, FontSize } from '../constants/colors'
import type { HarnessId } from '../types'

const HARNESS_ICON: Record<string, { icon: string; color: string }> = {
  'claude-code': { icon: 'cube-outline',     color: '#E47A4E' },
  'opencode':    { icon: 'document-outline', color: DarkColors.textPrimary },
  'gemini-cli':  { icon: 'terminal-outline', color: '#4285F4' },
}

interface Props {
  harness: HarnessId
  dir: string
  statusColor: string
  isActive: boolean
  /** circle diameter — defaults to 48 (list). Header uses ~34. */
  size?: number
}

export function HarnessAvatar({ harness, dir, statusColor, isActive, size = 48 }: Props) {
  const cfg = HARNESS_ICON[harness]
  const dot = Math.round(size / 4)

  return (
    <View style={[
      styles.container,
      { width: size, height: size, borderColor: statusColor + '60' },
    ]}>
      {cfg ? (
        <Ionicons name={cfg.icon} size={Math.round(size / 2)} color={cfg.color} />
      ) : (
        <Text style={[styles.letter, { fontSize: Math.round(size / 2.8) }]}>{dir.charAt(0).toUpperCase()}</Text>
      )}
      {isActive && (
        <View style={[styles.activeDot, { width: dot, height: dot, borderRadius: dot }]} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width:           48,
    height:          48,
    borderRadius:    Radius.full,
    backgroundColor: DarkColors.surface,
    borderWidth:     2,
    alignItems:      'center',
    justifyContent:  'center',
    flexShrink:      0,
  },
  letter: {
    fontSize:   FontSize.cardTitle,
    fontWeight: '700',
    color:      DarkColors.textPrimary,
    fontFamily: FontFamily.googleSans,
  },
  activeDot: {
    position:        'absolute',
    bottom:          1,
    right:           1,
    width:           12,
    height:          12,
    borderRadius:    Radius.full,
    backgroundColor: DarkColors.statusActive,
    borderWidth:     2,
    borderColor:     DarkColors.bg,
  },
})
