/** Workspace timestamps without an offset are stored in UTC by the server. */
export function displayDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) {
  if (!value) return '아직 기록 없음'
  const date = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? '날짜 확인 필요' : date.toLocaleString('ko-KR', options)
}
