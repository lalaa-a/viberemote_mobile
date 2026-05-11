import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Colors, Radius, FontSize } from '../constants/colors'
import type { RiskLevel } from '../types'

interface Props {
  level: RiskLevel
  showIcon?: boolean
}

const RISK_CONFIG: Record<RiskLevel, {
  label: string
  icon:  string
  style: { bg: string; text: string; border: string }
}> = {
  low:      { label: 'Low',      icon: '✓', style: Colors.risk.low      },
  medium:   { label: 'Medium',   icon: '!', style: Colors.risk.medium   },
  high:     { label: 'High',     icon: '!!',style: Colors.risk.high     },
  critical: { label: 'Critical', icon: '✕', style: Colors.risk.critical },
}

export function RiskBadge({ level, showIcon = true }: Props) {
  const cfg = RISK_CONFIG[level] ?? RISK_CONFIG.low

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: cfg.style.bg,
        borderColor:     cfg.style.border,
      },
    ]}>
      {showIcon && (
        <Text style={[styles.icon, { color: cfg.style.text }]}>
          {cfg.icon}
        </Text>
      )}
      <Text style={[styles.label, { color: cfg.style.text }]}>
        {cfg.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:   Radius.sm,
    borderWidth:    0.5,
  },
  icon: {
    fontSize:   FontSize.xs,
    fontWeight: '700',
  },
  label: {
    fontSize:   FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})
