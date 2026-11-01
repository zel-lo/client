import { useEffect, useState } from 'react'
import { startOfWeek, today } from '../lib/work-weeks'
import type { ProjectPeriod } from '../lib/work-weeks'

/** The clock follows the team's date; changing project periods takes effect immediately. */
export function useWorkWeek(period?: ProjectPeriod) {
  const [date, setDate] = useState(today)
  useEffect(() => {
    const update = () => setDate(today())
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  return startOfWeek(date, period)
}
