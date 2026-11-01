import type { IssueStatus } from '../data/work-items'

/** Calendar dates use the team's Korea time zone; arithmetic stays in UTC to avoid DST drift. */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export function startOfWeek(date = today()) {
  const value = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(value.getTime())) return startOfWeek(today())
  value.setUTCDate(value.getUTCDate() - (value.getUTCDay() + 6) % 7)
  return value.toISOString().slice(0, 10)
}
export function shiftWeek(week: string, offset: number) {
  const value = new Date(`${week}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + offset * 7)
  return value.toISOString().slice(0, 10)
}
export function validWeek(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && startOfWeek(value) === value ? value : startOfWeek()
}
export function weekLabel(week: string) {
  const end = new Date(`${shiftWeek(week, 1)}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  return `${Number(week.slice(5, 7))}.${Number(week.slice(8))} – ${end.getUTCMonth() + 1}.${end.getUTCDate()}`
}
export function completionDate(value: string | null | undefined) {
  if (!value) return null
  const instant = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`)
  if (!Number.isFinite(instant.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}
export function belongsToWeek(item: { status: IssueStatus; plannedWeekStart?: string; completedAt?: string | null }, week: string) {
  if (item.status === 'backlog') return true
  if (item.status === 'done') {
    const completed = completionDate(item.completedAt)
    return !!completed && startOfWeek(completed) === week
  }
  return (item.plannedWeekStart ?? startOfWeek()) <= week
}
