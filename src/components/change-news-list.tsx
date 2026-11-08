import type { ReactNode } from 'react'
import './change-news-list.css'

export type ChangeNewsItem = {
  id: string
  category: 'FEATURE' | 'IMPROVE' | 'FIX' | 'TEAM'
  date?: string | null
  title: string
  badge?: { label: string; tone: 'pending' | 'draft' | 'published' }
  metadata?: ReactNode
  action?: ReactNode
}
const sections = [
  { category: 'FEATURE', label: '새 기능' },
  { category: 'IMPROVE', label: '개선 사항' },
  { category: 'FIX', label: '오류 수정' },
  { category: 'TEAM', label: '팀 소식' },
] as const

function newsDate(value?: string | null) {
  if (!value) return null
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+09:00` : /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z')
  if (Number.isNaN(date.getTime())) return null
  return { value: date.toISOString(), label: date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }), full: date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric' }), timestamp: date.getTime() }
}

/** 날짜는 각 변경에 반복하고, 분류별 섹션에서 개별 변경을 바로 읽는다. */
export function ChangeNewsList({ items }: { items: ChangeNewsItem[] }) {
  return <div className="change-news-sections">{sections.map(section => {
    const rows = items.filter(item => item.category === section.category)
      .map(item => ({ ...item, formattedDate: newsDate(item.date) }))
      .sort((a, b) => (b.formattedDate?.timestamp ?? 0) - (a.formattedDate?.timestamp ?? 0))
    if (!rows.length) return null
    return <section className={`change-news-section is-${section.category.toLowerCase()}`} key={section.category} aria-label={section.label}>
      <div className="change-news-section-heading"><h3>{section.label}</h3><span>{rows.length}</span></div>
      <ul className="change-news-list">{rows.map(item => <li className="change-news-item" key={item.id}>
        <div className="change-news-date">{item.formattedDate ? <time dateTime={item.formattedDate.value} title={item.formattedDate.full}>{item.formattedDate.label}</time> : '날짜 미정'}</div>
        <div className="change-news-content"><h4>{item.title}</h4>{item.metadata && <div className="change-news-meta">{item.metadata}</div>}</div>
        <div className="change-news-side">{item.badge && <span className={`change-news-badge is-${item.badge.tone}`}>{item.badge.label}</span>}</div>
        {item.action}
      </li>)}</ul>
    </section>
  })}</div>
}
