import type { IssueStatus } from '../data/work-items'

/** Calendar dates use the team's Korea time zone; arithmetic stays in UTC to avoid DST drift. */
export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
export type ProjectPeriod = { startDate?: string | null; endDate?: string | null }
export function isCalendarDate(value: string) {
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1000 && Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === value
}
export function validProjectPeriod(period: ProjectPeriod) {
  if (!period.startDate || !period.endDate || !isCalendarDate(period.startDate) || !isCalendarDate(period.endDate)) return false
  const limit = new Date(`${period.startDate}T00:00:00Z`)
  const month = limit.getUTCMonth()
  limit.setUTCFullYear(limit.getUTCFullYear() + 10)
  if (limit.getUTCMonth() !== month) limit.setUTCDate(0)
  limit.setUTCDate(limit.getUTCDate() - 1)
  return period.endDate >= period.startDate && period.endDate <= limit.toISOString().slice(0, 10)
}
export function daysBetween(start: string, end: string) { return Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) }
export function projectWeekCount(period?: ProjectPeriod) { return period?.startDate && period.endDate ? Math.floor(daysBetween(period.startDate, period.endDate) / 7) + 1 : 0 }
export function projectWeekNumber(week: string, period?: ProjectPeriod) { return period?.startDate ? Math.floor(daysBetween(period.startDate, week) / 7) + 1 : null }
export function projectWeeks(period?: ProjectPeriod) { return period?.startDate ? Array.from({ length: Math.max(0, projectWeekCount(period)) }, (_, index) => shiftWeek(period.startDate!, index)) : [] }
export function startOfWeek(date = today(), period?: ProjectPeriod) {
  if (!isCalendarDate(date)) return startOfWeek(today(), period)
  if (period?.startDate && period.endDate) {
    const index = Math.max(0, Math.min(projectWeekCount(period) - 1, Math.floor(daysBetween(period.startDate, date) / 7)))
    return shiftWeek(period.startDate, index)
  }
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
export function validWeek(value: string | null, period?: ProjectPeriod) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && startOfWeek(value, period) === value ? value : startOfWeek(today(), period)
}
export function weekLabel(week: string, period?: ProjectPeriod) {
  const end = new Date(`${shiftWeek(week, 1)}T00:00:00Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  if (period?.endDate && period.endDate < end.toISOString().slice(0, 10)) end.setTime(Date.parse(`${period.endDate}T00:00:00Z`))
  return `${Number(week.slice(5, 7))}.${Number(week.slice(8))} – ${end.getUTCMonth() + 1}.${end.getUTCDate()}`
}
export function completionDate(value: string | null | undefined) {
  if (!value) return null
  const instant = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`)
  if (!Number.isFinite(instant.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant)
}
export function belongsToWeek(item: { status: IssueStatus; plannedWeekStart?: string; completedAt?: string | null }, week: string, period?: ProjectPeriod) {
  if (item.status === 'backlog') return true
  if (item.status === 'done') {
    const completed = completionDate(item.completedAt)
    return !!completed && (!period?.startDate || completed >= period.startDate) && startOfWeek(completed, period) === week
  }
  return (item.plannedWeekStart ?? startOfWeek()) <= week
}
