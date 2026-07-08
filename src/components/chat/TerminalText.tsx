import React, { useEffect } from 'react'
import { Text, StyleSheet } from 'react-native'
import type { TextStyle } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation,
} from 'react-native-reanimated'
import { useTypewriter } from '../../hooks/useTypewriter'
import { DarkColors, FontFamily, FontSize } from '../../constants/colors'

interface Props {
  text:      string
  /** animate the reveal (true only for the newest live row) */
  animate?:  boolean
  onDone?:   () => void
  style?:    TextStyle
}

// Blinking block cursor shown while text is still printing.
function Cursor() {
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true)
    return () => cancelAnimation(opacity)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.Text style={[styles.cursor, style]}>▋</Animated.Text>
}

// Monospace terminal block that prints its text sequentially (CLI style).
export function TerminalText({ text, animate = false, onDone, style }: Props) {
  const { shown, done } = useTypewriter(text, { enabled: animate, onDone })
  return (
    <Text style={[styles.text, style]} selectable>
      {shown}
      {animate && !done ? <Cursor /> : null}
    </Text>
  )
}

const styles = StyleSheet.create({
  text: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.mono,
    color:      DarkColors.textPrimary,
    lineHeight: 20,
  },
  cursor: {
    fontFamily: FontFamily.mono,
    fontSize:   FontSize.mono,
    color:      DarkColors.online,
  },
})
