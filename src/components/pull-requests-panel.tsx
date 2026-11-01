import { Link, useSearchParams } from 'react-router-dom'
import { Check, CircleDashed, CircleX, GitMerge, GitPullRequest, Link2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Repo } from '@/data/mock'
import { repositoryRef } from '@/data/work-items'
import type { Issue, PullRequest } from '@/data/work-items'

const statusLabels = { open: '열림', merged: '병합됨', closed: '닫힘', draft: '초안' }
export const reviewLabels = { pending: '검토 대기', approved: '승인됨', changes_requested: '수정 요청', unknown: '수집 전' }

/** 상세의 "코드 검토" 문구. 닫히거나 병합된 PR은 열려 있을 때의 마지막 리뷰 결과로 설명한다. */
export function reviewSummary(pr: Pick<PullRequest, 'status' | 'review'>) {
  if (pr.status === 'draft') return '초안 · 아직 검토 요청 전'
  if (pr.status === 'merged') return { approved: '승인 후 병합됨', changes_requested: '수정 요청이 남은 채 병합됨', pending: '승인 없이 병합됨', unknown: '병합됨 · 리뷰 기록 없음' }[pr.review]
  if (pr.status === 'closed') return pr.review === 'unknown' ? '병합하지 않고 닫힘' : `병합하지 않고 닫힘 · 마지막 리뷰 ${reviewLabels[pr.review]}`
  return reviewLabels[pr.review]
}
export const checkLabels = { passing: '검사 통과', failing: '검사 실패', running: '검사 중', unknown: '수집 전' }

/** 실제 PR 목록의 페이지 정보. 탭·검토 상태 필터·페이지는 서버가 거른 결과이고, counts는 탭별 전체 개수다. */
export type PullRequestPaging = { page: number; hasNext: boolean; total: number; counts: { open: number; merged: number; all: number } }

export function PullRequestsPanel({ pullRequests, repos, issues, repoFilter, onSelect, onSelectIssue, live = false, loading = false, error = '', reauth = false, paging, needsSetup = false }: {
  pullRequests: PullRequest[]; repos: Repo[]; issues: Issue[]; repoFilter: string; onSelect: (pr: PullRequest) => void; onSelectIssue: (issue: Issue) => void;
  needsSetup?: boolean; live?: boolean; loading?: boolean; error?: string; reauth?: boolean; paging?: PullRequestPaging;
}) {
  const [params, setParams] = useSearchParams()
  const filter = params.get('status') ?? 'open'
  const focus = params.get('focus') ?? 'all'
  const page = paging?.page ?? 1
  // 탭이나 필터를 바꾸면 첫 페이지로 돌아간다.
  function change(key: string, value: string) {
    const next = new URLSearchParams(params)
    if ((key === 'status' && value === 'open') || (key === 'focus' && value === 'all') || (key === 'page' && value === '1')) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next)
  }
  const unlinked = (pr: PullRequest) => !issues.some(issue => issue.pullRequestIds.includes(pr.id))
  const scoped = paging
    ? pullRequests.filter(pr => focus !== 'unlinked' || unlinked(pr))
    : pullRequests.filter(pr => (repoFilter === 'all' || pr.repo === repoFilter) && (focus === 'all' || (focus === 'pending' ? pr.status === 'open' && pr.review === 'pending' : focus === 'failing' ? pr.status === 'open' && (pr.checks === 'failing' || pr.review === 'changes_requested') : focus === 'unlinked' ? unlinked(pr) : true)))
  const visible = paging ? scoped : scoped.filter(pr => filter === 'all' || (filter === 'open' ? pr.status === 'open' || pr.status === 'draft' : pr.status === filter))
  const tabCount = (value: string) => paging ? paging.counts[value as keyof PullRequestPaging['counts']]
    : scoped.filter(pr => value === 'all' || (value === 'open' ? ['open', 'draft'].includes(pr.status) : pr.status === value)).length
  return <section className="work-panel" aria-label="Pull requests 목록">
    <div className="content-filter"><div className="segmented-tabs">
      {[['open', '열림'], ['merged', '병합됨'], ['all', '전체']].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'selected' : ''} onClick={() => change('status', value)}>{label}<span className="tab-count">{tabCount(value)}</span></button>)}
    </div><span className="muted small">{needsSetup ? '저장소 연결 필요' : live ? `GitHub 연동${paging && focus !== 'all' && focus !== 'unlinked' ? ` · 조건에 맞는 PR ${paging.total}개` : ''}` : '샘플 PR · GitHub 미연결'}</span></div>
    {error && <div className="connection-error" role="alert">{error}{reauth && <Link to="/login?reauth=github">GitHub 다시 로그인</Link>}</div>}
    {loading && !pullRequests.length && <p role="status">PR을 불러오는 중…</p>}
    <div className="work-filter-bar"><select aria-label="PR 확인 필터" value={focus} onChange={event => change('focus', event.target.value)}><option value="all">모든 검토 상태</option><option value="pending">검토 대기</option><option value="failing">수정 또는 검사 실패</option><option value="unlinked">이슈 미연결</option></select>{params.size > 0 && <button className="subtle-link" onClick={() => setParams({})}>필터 초기화</button>}</div>
    <div className="data-frame"><Table><TableHeader><TableRow><TableHead>변경 요청</TableHead><TableHead>코드 검토</TableHead><TableHead>자동 검사 · CI</TableHead><TableHead>리뷰어</TableHead><TableHead>작성자</TableHead></TableRow></TableHeader><TableBody>
      {visible.map(pr => {
        const linked = issues.filter(issue => issue.pullRequestIds.includes(pr.id))
        const Icon = pr.status === 'merged' ? GitMerge : pr.status === 'draft' ? CircleDashed : GitPullRequest
        return <TableRow key={pr.id}><TableCell><button className="pr-work-title" onClick={() => onSelect(pr)}><Icon size={17} className={`pr-icon pr-icon-${pr.status}`} /><span>{pr.title}<small className="pr-work-meta">{repositoryRef(pr.repo, pr.number, repos)} · {pr.branch}</small></span></button>{linked.length > 0 && <span className="linked-issue-chips">{linked.map(issue => <button className="reference-link" key={issue.id} onClick={() => onSelectIssue(issue)}><Link2 size={10} />{repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)}</button>)}</span>}</TableCell>
        <TableCell><span className={`review-state review-${pr.review}`}>{pr.status === 'open' ? reviewLabels[pr.review] : statusLabels[pr.status]}</span></TableCell>
        <TableCell><span className={`check-state check-${pr.checks}`}>{pr.checks === 'passing' ? <Check size={12} /> : pr.checks === 'failing' ? <CircleX size={12} /> : <CircleDashed size={12} />}{checkLabels[pr.checks]}</span></TableCell>
        <TableCell className="table-secondary">{pr.reviewers?.length ? pr.reviewers.join(', ') : <span className="muted">지정 안 함</span>}</TableCell>
        <TableCell className="table-secondary">{pr.author}</TableCell></TableRow>
      })}
    </TableBody></Table></div>
    {paging && (page > 1 || paging.hasNext) && <div className="connection-pagination" aria-label="PR 페이지"><button className="button" disabled={loading || page === 1} onClick={() => change('page', String(page - 1))}>이전</button><span>{page} 페이지</span><button className="button" disabled={loading || !paging.hasNext} onClick={() => change('page', String(page + 1))}>다음</button></div>}
    {!visible.length && !loading &&<div className="empty-state"><GitPullRequest size={25} />{needsSetup ? <><h3>팀의 저장소를 연결해 주세요</h3><p>저장소를 고르면 실제 코드 검토와 작업을 확인할 수 있어요.</p><Link className="button" to="/onboarding">프로젝트와 저장소 연결</Link></> : live && !pullRequests.length ? <><h3>아직 가져온 PR이 없어요</h3><p>위의 새로고침 버튼으로 GitHub에서 PR을 가져와 보세요. 저장소가 연결되어 있어야 해요.</p></> : <><h3>이 조건의 PR이 없어요</h3><p>저장소나 상태를 바꿔서 확인해 보세요.</p></>}</div>}
  </section>
}
