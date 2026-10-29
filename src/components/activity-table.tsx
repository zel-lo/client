import { useState } from 'react'
import { ArrowUpRight, CircleDot, GitCommitHorizontal, GitMerge, GitPullRequest, Rocket } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dateLabel, typeLabels } from '@/data/mock'
import type { Activity, Repo } from '@/data/mock'

const icons = { merge: GitMerge, commit: GitCommitHorizontal, pr: GitPullRequest, issue: CircleDot, deploy: Rocket }
export function ActivityTable({ activities, repos, onSelect, onViewAll }: {
  activities: Activity[]; repos: Repo[]; onSelect: (item: Activity) => void; onViewAll: () => void;
}) {
  const [filter, setFilter] = useState('all')
  const visible = activities.filter(item => filter === 'all' || (filter === 'pr' ? ['pr', 'merge'].includes(item.type) : item.type === filter)).slice(0, 6)
  return <section className="activity-table-section" aria-label="최근 개발 기록">
    <div className="section-heading"><div className="segmented-tabs">{[['all', '최근 기록'], ['pr', '코드 검토'], ['deploy', '배포']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><button className="button" onClick={onViewAll}>전체 기록 <ArrowUpRight size={14} /></button></div>
    <div className="data-frame"><Table><TableHeader><TableRow><TableHead>작업 내용</TableHead><TableHead>상태</TableHead><TableHead>저장소</TableHead><TableHead>담당자</TableHead><TableHead>시간</TableHead></TableRow></TableHeader><TableBody>
      {visible.map(item => { const Icon = icons[item.type]; return <TableRow key={item.id}><TableCell><button className="table-title-button" onClick={() => onSelect(item)}><Icon size={15} className={`table-event-${item.type}`} /><span>{item.title}<small className="mono">{item.ref}</small></span></button></TableCell><TableCell><span className={`badge badge-${item.type === 'merge' ? 'purple' : item.type === 'deploy' ? 'green' : 'neutral'}`}>{typeLabels[item.type]}</span></TableCell><TableCell className="table-secondary">{repos.find(repo => repo.id === item.repo)?.name}</TableCell><TableCell className="table-secondary">{item.author}</TableCell><TableCell className="table-secondary table-date">{dateLabel(item.date) === '오늘' ? item.time : dateLabel(item.date)}</TableCell></TableRow> })}
      {!visible.length && <TableRow><TableCell colSpan={5}><div className="table-empty">이 조건의 기록이 없어요. 다른 저장소나 기간을 선택해 보세요.</div></TableCell></TableRow>}
    </TableBody></Table></div><div className="table-footnote">최근 {visible.length}개 기록 · 작업을 선택하면 자세한 내용을 확인할 수 있어요.</div>
  </section>
}
