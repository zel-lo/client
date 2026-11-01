import { useEffect, useState } from 'react'
import { startOfWeek } from '../lib/work-weeks'

/** An open board follows the new week without a reload; a selected historical week stays selected. */
export function useWorkWeek() {
  const [week, setWeek] = useState(startOfWeek)
  useEffect(() => {
    const update = () => setWeek(startOfWeek())
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  return week
}
