import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

interface Options {
  /** characters per second */
  cps?:     number
  /** when false the full text is shown immediately (no animation) */
  enabled?: boolean
  /** called once the reveal finishes (or when disabled/reduced-motion → immediate) */
  onDone?:  () => void
}

/**
 * Progressive character reveal — mimics a CLI printing sequentially.
 *
 * Text arrives whole from the backend (one terminal_events row); this reveals it
 * slice-by-slice on a timer. Respects the OS "reduce motion" setting. When
 * `enabled` is false it returns the full text immediately — this is how the chat
 * feed keeps history / recycled rows instant and only animates the newest live row.
 */
export function useTypewriter(text: string, { cps = 50, enabled = true, onDone }: Options = {}) {
  const [count, setCount] = useState(enabled ? 0 : text.length)
  const reduceRef = useRef(false)
  const doneRef   = useRef(false)

  // Read the reduce-motion preference once on mount.
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (active) reduceRef.current = v })
    return () => { active = false }
  }, [])

  useEffect(() => {
    // Instant paths: disabled, reduced motion, or empty.
    if (!enabled || reduceRef.current || text.length === 0) {
      setCount(text.length)
      if (!doneRef.current) { doneRef.current = true; onDone?.() }
      return
    }

    setCount(0)
    doneRef.current = false
    const stepMs = Math.max(8, 1000 / cps)
    // Reveal a few chars per tick so long outputs don't take forever.
    const perTick = Math.max(1, Math.round(text.length / 400))

    const timer = setInterval(() => {
      setCount(prev => {
        const next = Math.min(text.length, prev + perTick)
        if (next >= text.length) {
          clearInterval(timer)
          if (!doneRef.current) { doneRef.current = true; onDone?.() }
        }
        return next
      })
    }, stepMs)

    return () => clearInterval(timer)
  }, [text, enabled, cps]) // eslint-disable-line react-hooks/exhaustive-deps

  return { shown: text.slice(0, count), done: count >= text.length }
}
