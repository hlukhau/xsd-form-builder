import { useEffect, useRef } from 'react'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'

const MINUTE_MS = 60_000

/** События мыши и клавиатуры, по которым считается активность пользователя. */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'click', 'keydown', 'keyup'] as const

/**
 * Раз в `intervalMs` шлёт родителю postMessage с code: «activity», только если за последний интервал
 * были события мыши или клавиатуры (иначе сессию не продлеваем).
 */
export function useParentActivityPing(intervalMs: number = MINUTE_MS): void {
  const lastActivityRef = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const markActivity = (): void => {
      lastActivityRef.current = Date.now()
    }

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, markActivity, { passive: true })
    }

    const tick = (): void => {
      const idleMs = Date.now() - lastActivityRef.current
      if (lastActivityRef.current === 0 || idleMs > intervalMs) return
      postMessageFromCardToParent(
        { code: 'activity' },
        'продление сессии (есть активность мыши/клавиатуры за последний интервал)'
      )
    }

    const id = window.setInterval(tick, intervalMs)
    return () => {
      window.clearInterval(id)
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, markActivity)
      }
    }
  }, [intervalMs])
}
