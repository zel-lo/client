import { useState } from 'react'
import { GitCommitHorizontal, GitMerge } from 'lucide-react'
import { inPeriod, periods } from '@/data/mock'
import type { Activity, Period } from '@/data/mock'

type Point = { date: string; commits: number; merged: number }
const WIDTH = 1060
const HEIGHT = 235
const LEFT = 35
const RIGHT = 12
const TOP = 16
const BOTTOM = 28
const DAY = 86400000

function curve(points: [number, number][]) {
  if (!points.length) return ''
  return points.reduce((path, p, i) => {
    if (!i) return `M ${p[0]} ${p[1]}`
    const prev = points[i - 1]
    const mid = (prev[0] + p[0]) / 2
    return `${path} C ${mid} ${prev[1]}, ${mid} ${p[1]}, ${p[0]} ${p[1]}`
  }, '')
}
export function ActivityChart({ activities, period, onPeriod }: {
  activities: Activity[]; period: Period; onPeriod: (p: Period) => void;
}) {
  const [active, setActive] = useState<number | null>(null)
  const selected = periods[period]
  const end = 'end' in selected ? selected.end : '2026-10-27'
  const days: Point[] = []
  for (let ms = Date.parse(selected.start); ms <= Date.parse(end); ms += DAY) {
    const date = new Date(ms).toISOString().slice(0, 10)
    const matches = activities.filter(a => a.date === date)
    days.push({ date, commits: matches.reduce((sum, a) => sum + a.commits, 0), merged: matches.filter(a => a.type === 'merge').length })
  }
  const max = Math.max(4, ...days.map(d => d.commits))
  const ceiling = Math.ceil(max / 4) * 4
  const floor = HEIGHT - BOTTOM
  const x = (i: number) => LEFT + i / Math.max(1, days.length - 1) * (WIDTH - LEFT - RIGHT)
  const y = (v: number) => TOP + (1 - v / ceiling) * (floor - TOP)
  const commits = days.map((d, i) => [x(i), y(d.commits)] as [number, number])
  const merged = days.map((d, i) => [x(i), y(d.merged)] as [number, number])
  const line = curve(commits)
  const mergedLine = curve(merged)
  const tickStep = Math.max(1, Math.ceil((days.length - 1) / 6))
  const activeDay = active === null ? null : days[active]
  const summary = activities.filter(a => inPeriod(a, period))
  const total = summary.reduce((sum, a) => sum + a.commits, 0)
  return <section className="development-chart" aria-label="기간별 개발 활동 그래프">
    <div className="development-chart-heading"><div><h2>개발 활동</h2><p>커밋과 PR 반영으로 보는 프로젝트의 흐름</p></div><div className="chart-range" aria-label="그래프 조회 기간">{(['month', 'previous', 'week'] as Period[]).map(p => <button key={p} aria-pressed={period === p} className={period === p ? 'selected' : ''} onClick={() => { setActive(null); onPeriod(p) }}>{periods[p].label}</button>)}</div></div>
    <div className="chart-legend"><span><i className="legend-commit" /><GitCommitHorizontal size={12} />Commits</span><span><i className="legend-merge" /><GitMerge size={12} />Merged PRs</span><span className="chart-selected-period">{selected.range}</span></div>
    <div className="chart-plot" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`${selected.range}, 커밋 ${total}개와 병합 PR ${summary.filter(a => a.type === 'merge').length}개`}>
        <defs><linearGradient id="commit-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.24" /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.015" /></linearGradient><linearGradient id="merge-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity="0.14" /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity="0.015" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map(n => <g key={n}><line x1={LEFT} x2={WIDTH - RIGHT} y1={y(n * ceiling / 4)} y2={y(n * ceiling / 4)} stroke="var(--line)" strokeWidth="1" strokeDasharray={n ? '3 5' : undefined} /><text x={LEFT - 12} y={y(n * ceiling / 4) + 3} textAnchor="end" className="chart-axis">{n * ceiling / 4}</text></g>)}
        <path d={`${line} L ${x(days.length - 1)} ${floor} L ${LEFT} ${floor} Z`} fill="url(#commit-fill)" />
        <path d={`${mergedLine} L ${x(days.length - 1)} ${floor} L ${LEFT} ${floor} Z`} fill="url(#merge-fill)" />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path d={mergedLine} fill="none" stroke="var(--chart-2)" strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
        {active !== null && <g><line x1={x(active)} x2={x(active)} y1={TOP} y2={floor} stroke="var(--muted-foreground)" strokeDasharray="3 4" /><circle cx={x(active)} cy={y(days[active].commits)} r="4" fill="var(--chart-1)" stroke="var(--card)" strokeWidth="2" /><circle cx={x(active)} cy={y(days[active].merged)} r="4" fill="var(--chart-2)" stroke="var(--card)" strokeWidth="2" /></g>}
        {days.map((d, i) => <g key={d.date}>{(i % tickStep === 0 || i === days.length - 1) && <text x={x(i)} y={HEIGHT - 5} textAnchor={i === 0 ? 'start' : i === days.length - 1 ? 'end' : 'middle'} className="chart-axis">{Number(d.date.slice(5, 7))}/{Number(d.date.slice(8))}</text>}<rect x={x(i) - (WIDTH - LEFT - RIGHT) / days.length / 2} y={TOP} width={(WIDTH - LEFT - RIGHT) / days.length} height={floor - TOP} fill="transparent" tabIndex={0} role="button" aria-label={`${d.date}, 커밋 ${d.commits}개, 병합 PR ${d.merged}개`} onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)} onClick={() => setActive(i)} onKeyDown={e => { if (e.key === 'Escape') setActive(null); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i) } }} /></g>)}
      </svg>
      {activeDay && <div className="chart-tooltip" role="status" style={{ left: `${Math.max(15, Math.min(82, x(active!) / WIDTH * 100))}%` }}><strong>{activeDay.date.replaceAll('-', '.')}</strong><span><i className="legend-commit" />Commits<b>{activeDay.commits}</b></span><span><i className="legend-merge" />Merged PRs<b>{activeDay.merged}</b></span></div>}
    </div>
    <div className="chart-summary"><span><span className="chart-summary-dot" />선택한 기간에 <strong>{total}개의 커밋</strong>과 <strong>{summary.filter(a => a.type === 'merge').length}개의 PR</strong>이 기록됐어요.</span><span>목데이터 기준</span></div>
  </section>
}
