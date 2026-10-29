import { useSearchParams } from 'react-router-dom'
import { Check, CircleDashed, CircleX, GitMerge, GitPullRequest, Link2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Repo } from '@/data/mock'
import { repositoryRef } from '@/data/work-items'
import type { Issue, PullRequest } from '@/data/work-items'

const statusLabels = { open: '열림', merged: '병합됨', closed: '닫힘', draft: '초안' }
export const reviewLabels = { pending: '검토 대기', approved: '승인됨', changes_requested: '수정 요청' }
export const checkLabels = { passing: '검사 통과', failing: '검사 실패', running: '검사 중' }

export function PullRequestsPanel({ pullRequests, repos, issues, repoFilter, onSelect, onSelectIssue }: {
  pullRequests: PullRequest[]; repos: Repo[]; issues: Issue[]; repoFilter: string; onSelect: (pr: PullRequest) => void; onSelectIssue: (issue: Issue) => void;
}) {
  const [params, setParams] = useSearchParams()
  const filter = params.get('status') ?? 'open'
  const focus = params.get('focus') ?? 'all'
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if ((key === 'status' && value === 'open') || (key === 'focus' && value === 'all')) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }
  const scoped = pullRequests.filter(pr => (repoFilter === 'all' || pr.repo === repoFilter) && (focus === 'all' || (focus === 'pending' ? pr.status === 'open' && pr.review === 'pending' : focus === 'failing' ? pr.status === 'open' && (pr.checks === 'failing' || pr.review === 'changes_requested') : focus === 'unlinked' ? !issues.some(issue => issue.pullRequestIds.includes(pr.id)) : true)))
  const visible = scoped.filter(pr => filter === 'all' || (filter === 'open' ? pr.status === 'open' || pr.status === 'draft' : pr.status === filter))
  return <section className="work-panel" aria-label="Pull requests 목록">
    <div className="content-filter"><div className="segmented-tabs">
      {[['open', '열림'], ['merged', '병합됨'], ['all', '전체']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => change('status', value)}>{label}<span className="tab-count">{scoped.filter(pr => value === 'all' || (value === 'open' ? ['open', 'draft'].includes(pr.status) : pr.status === value)).length}</span></button>)}
    </div><span className="muted small">샘플 PR · GitHub 미연결</span></div>
    <div className="work-filter-bar"><select aria-label="PR 확인 필터" value={focus} onChange={event => change('focus', event.target.value)}><option value="all">모든 검토 상태</option><option value="pending">검토 대기</option><option value="failing">수정 또는 검사 실패</option><option value="unlinked">이슈 미연결</option></select>{params.size > 0 && <button className="subtle-link" onClick={() => setParams({})}>필터 초기화</button>}</div>
    <div className="data-frame"><Table><TableHeader><TableRow><TableHead>변경 요청</TableHead><TableHead>코드 검토</TableHead><TableHead>자동 검사 · CI</TableHead><TableHead>작성자</TableHead></TableRow></TableHeader><TableBody>
      {visible.map(pr => {
        const linked = issues.filter(issue => issue.pullRequestIds.includes(pr.id))
        const Icon = pr.status === 'merged' ? GitMerge : pr.status === 'draft' ? CircleDashed : GitPullRequest
        return <TableRow key={pr.id}><TableCell><button className="pr-work-title" onClick={() => onSelect(pr)}><Icon size={17} className={`pr-icon pr-icon-${pr.status}`} /><span>{pr.title}<small className="pr-work-meta">{repositoryRef(pr.repo, pr.number, repos)} · {pr.branch}</small></span></button>{linked.length > 0 && <span className="linked-issue-chips">{linked.map(issue => <button className="reference-link" key={issue.id} onClick={() => onSelectIssue(issue)}><Link2 size={10} />{repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)}</button>)}</span>}</TableCell>
        <TableCell><span className={`review-state review-${pr.review}`}>{pr.status === 'merged' ? statusLabels.merged : pr.status === 'draft' ? statusLabels.draft : reviewLabels[pr.review]}</span></TableCell>
        <TableCell><span className={`check-state check-${pr.checks}`}>{pr.checks === 'passing' ? <Check size={12} /> : pr.checks === 'failing' ? <CircleX size={12} /> : <CircleDashed size={12} />}{checkLabels[pr.checks]}</span></TableCell>
        <TableCell className="table-secondary">{pr.author}</TableCell></TableRow>
      })}
    </TableBody></Table></div>
    {!visible.length && <div className="empty-state"><GitPullRequest size={25} /><h3>이 조건의 PR이 없어요</h3><p>저장소나 상태를 바꿔서 확인해 보세요.</p></div>}
  </section>
}
