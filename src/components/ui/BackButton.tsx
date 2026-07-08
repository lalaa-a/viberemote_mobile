import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import type { ViewStyle } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Ionicons from 'react-native-vector-icons/Ionicons'
import { DarkColors, Radius } from '../../constants/colors'

interface Props {
  onPress?: () => void
  style?:   ViewStyle
}

// Shared circular back button — use on every dark screen for a consistent look.
export function BackButton({ onPress, style }: Props) {
  const navigation = useNavigation()
  return (
    <TouchableOpacity
      onPress={onPress ?? (() => navigation.goBack())}
      style={[styles.btn, style]}
      activeOpacity={0.75}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="chevron-back" size={24} color={DarkColors.textPrimary} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  btn: {
    width: 48, height: 48, borderRadius: Radius.full,
    backgroundColor: DarkColors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center',
  },
})
