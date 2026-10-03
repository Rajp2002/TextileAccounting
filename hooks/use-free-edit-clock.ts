'use client'
import { useEffect, useState } from 'react'
/** Advance trusted server time locally; refresh on focus and after every save. */
export function useFreeEditClock(serverTime?: string) {
  const [clock, setClock] = useState(() => ({source:serverTime, now:serverTime ? Date.parse(serverTime) : 0}))
  useEffect(() => {
    if (!serverTime) return
    const receivedAt = Date.now(), origin = Date.parse(serverTime)
    const tick = () => setClock({source:serverTime,now:origin + Math.max(0, Date.now() - receivedAt)})
    tick()
    const timer = setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => { clearInterval(timer); window.removeEventListener('focus', tick) }
  }, [serverTime])
  // Use the new response immediately, before the effect resets the ticking clock.
  return clock.source === serverTime ? clock.now : serverTime ? Date.parse(serverTime) : 0
}
