import { useState } from 'react'
import type { ReactNode } from 'react'
import { CircleDot, GitPullRequest, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CURRENT_USER, issueStatuses, needsMyReview, repositoryRef } from '@/data/work-items'
import type { Issue, PullRequest } from '@/data/work-items'
import type { Repo } from '@/data/mock'
import { checkLabels } from './pull-requests-panel'

export function MyWorkPanel({ issues, pullRequests, issuePullRequests = pullRequests, authoredPullRequests, reviewPullRequests, viewerName = CURRENT_USER, repos, repoFilter, onIssue, onPr, live = false, error = '', liveIssueContent }: {
  liveIssueContent?: ReactNode; issues: Issue[]; pullRequests: PullRequest[]; repos: Repo[]; repoFilter: string; onIssue: (issue: Issue) => void; onPr: (pr: PullRequest) => void;
  issuePullRequests?: PullRequest[]; authoredPullRequests?: PullRequest[]; reviewPullRequests?: PullRequest[]; viewerName?: string; live?: boolean; error?: string;
}) {
  const [tab, setTab] = useState('issues')
  const myIssues = issues.filter(issue => issue.assignee === CURRENT_USER && issue.status !== 'done' && (repoFilter === 'all' || issue.repo === repoFilter))
  const reviews = (reviewPullRequests ?? pullRequests.filter(needsMyReview)).filter(pr => repoFilter === 'all' || pr.repo === repoFilter)
  const authored = (authoredPullRequests ?? pullRequests.filter(pr => pr.author === CURRENT_USER && ['open', 'draft'].includes(pr.status))).filter(pr => repoFilter === 'all' || pr.repo === repoFilter)
  const visiblePrs = tab === 'reviews' ? reviews : authored
  return <section aria-label="내 작업 목록"><div className="content-filter"><div className="segmented-tabs">{[['issues', '맡은 작업', myIssues.length], ['reviews', '검토 요청', reviews.length], ['authored', '내 PR', authored.length]].map(([value, label, count]) => <button key={value} className={tab === value ? 'selected' : ''} aria-pressed={tab === value} onClick={() => setTab(String(value))}>{label}{!(value === "issues" && liveIssueContent) && <span className="tab-count">{count}</span>}</button>)}</div><span className="muted small"><UserRound size={12} className="inline-icon" />{viewerName} 님 · 미완료 작업</span></div>
    {error && <div className="connection-error" role="alert">{error}</div>}
    {tab === "issues" && liveIssueContent ? liveIssueContent : <><div className="data-frame"><Table><TableHeader><TableRow><TableHead>{tab === 'issues' ? '내가 맡은 작업' : tab === 'reviews' ? '내 검토를 기다리는 PR' : '내가 올린 PR'}</TableHead><TableHead>{tab === 'issues' ? '진행 상태' : '자동 검사'}</TableHead><TableHead>{tab === 'issues' ? '연결된 PR' : '작성자'}</TableHead></TableRow></TableHeader><TableBody>
      {tab === 'issues' ? myIssues.map(issue => <TableRow key={issue.id}><TableCell><button className="table-title-button" onClick={() => onIssue(issue)}><CircleDot size={15} /><span>{issue.title}<small>{issue.id} · {repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)}</small></span></button></TableCell><TableCell><span className={`issue-status-badge issue-status-${issue.status}`}>{issueStatuses[issue.status]}</span></TableCell><TableCell><div className="issue-linked-actions">{issuePullRequests.filter(pr => issue.pullRequestIds.includes(pr.id)).map(pr => <button className="reference-link" key={pr.id} onClick={() => onPr(pr)}><GitPullRequest size={12} />{repositoryRef(pr.repo, pr.number, repos)}</button>)}{!issue.pullRequestIds.length && <span className="muted small">아직 연결되지 않았어요</span>}</div></TableCell></TableRow>) : visiblePrs.map(pr => <TableRow key={pr.id}><TableCell><button className="table-title-button" onClick={() => onPr(pr)}><GitPullRequest size={15} /><span>{pr.title}<small>{repositoryRef(pr.repo, pr.number, repos)} · {pr.branch}</small></span></button></TableCell><TableCell><span className={`check-state check-${pr.checks}`}>{checkLabels[pr.checks]}</span></TableCell><TableCell className="table-secondary">{pr.author}</TableCell></TableRow>)}
    </TableBody></Table></div>
    {!(tab === 'issues' ? myIssues.length : visiblePrs.length) && <div className="empty-state"><UserRound size={25} /><h3>{tab === 'issues' ? '내가 맡은 미완료 작업이 없어요' : tab === 'reviews' ? '요청받은 코드 검토가 없어요' : '내가 올린 진행 중인 PR이 없어요'}</h3><p>다른 담당자의 작업은 팀 작업과 코드 검토에서 확인할 수 있어요.</p><Link className="button" to={tab === 'issues' ? '/issues' : '/pull-requests'}>{tab === 'issues' ? '팀 작업 보기' : '코드 검토 보기'}</Link></div>}
    </>}
    <p className="work-demo-note">현재 프로젝트에서 {viewerName} 님이 맡은 일과 검토 요청을 모았어요. 알림을 읽어도 작업 완료나 검토 승인을 하지 않은 항목은 여기에 계속 남습니다.{live && ' 맡은 작업, 내 PR, 검토 요청은 서버의 실제 데이터예요.'}</p>
  </section>
}
