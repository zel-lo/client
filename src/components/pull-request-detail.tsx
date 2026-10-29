import { ArrowRight, CheckCircle2, ChevronRight, CircleDot, FileText, GitBranch, GitMerge, GitPullRequest } from 'lucide-react'
import { activities } from '@/data/mock'
import type { Repo } from '@/data/mock'
import { repositoryRef } from '@/data/work-items'
import type { Issue, PullRequest } from '@/data/work-items'
import { checkLabels, reviewLabels } from './pull-requests-panel'

export function PullRequestDetail({ pr, repos, issues, onViewIssue }: {
  pr: PullRequest; repos: Repo[]; issues: Issue[]; onViewIssue: (issue: Issue) => void;
}) {
  const activity = activities.find(item => item.id === pr.activityId)
  const linked = issues.filter(issue => issue.pullRequestIds.includes(pr.id))
  return <div className="detail-content pr-detail"><span className={`event-icon large event-${pr.status === 'merged' ? 'merge' : 'pr'}`}>{pr.status === 'merged' ? <GitMerge size={24} /> : <GitPullRequest size={24} />}</span>
    <div className="detail-kicker"><span className="badge">{pr.status === 'merged' ? '병합됨' : pr.status === 'draft' ? '초안' : pr.status === 'closed' ? '닫힘' : '검토 요청'}</span><span className="mono muted">{repositoryRef(pr.repo, pr.number, repos)}</span></div><h2>{pr.title}</h2><div className="detail-author"><strong>{pr.author}</strong><span>샘플 PR</span></div>
    <div className="pr-branch-flow"><GitBranch size={14} /><code>{pr.branch}</code><ArrowRight size={13} /><code>{pr.base}</code></div>
    <div className="detail-summary"><span className="eyebrow">팀을 위한 변경 요약</span><p>{pr.summary || activity?.summary || '아직 변경 요약이 없어요.'}</p></div>
    {activity && <div className="diff-summary" aria-label="변경 파일 요약"><div><strong>{activity.files}</strong><span>변경 파일</span></div><div><strong className="diff-add">+{activity.additions}</strong><span>추가한 줄</span></div><div><strong className="diff-delete">−{activity.deletions}</strong><span>삭제한 줄</span></div></div>}
    {!activity && <p className="help-text"><FileText size={12} />파일별 변경 내용은 실제 GitHub 연결 후 수집됩니다.</p>}
    <dl className="detail-properties"><div><dt>코드 검토</dt><dd>{pr.status === 'draft' ? '초안 · 아직 검토 요청 전' : reviewLabels[pr.review]}</dd></div><div><dt>CI 검사</dt><dd className={`check-state check-${pr.checks}`}>{checkLabels[pr.checks]}</dd></div><div><dt>코드 병합</dt><dd>{pr.status === 'merged' ? <><CheckCircle2 size={13} />기본 브랜치에 반영됨</> : '아직 병합되지 않았어요'}</dd></div><div><dt>서비스 배포</dt><dd>{activity?.deployed ? '배포 완료' : '아직 배포되지 않았어요'}</dd></div></dl>
    <div className="pr-linked-issues"><h3>이 변경으로 해결하는 이슈</h3>{linked.map(issue => <button className="command-item" key={issue.id} onClick={() => onViewIssue(issue)}><CircleDot size={14} /><span><small>{issue.id} · {repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)} · {issue.assignee || '담당자 미지정'}</small>{issue.title}</span><ChevronRight size={14} /></button>)}{!linked.length && <p className="help-text">연결된 이슈가 없어요. 할 일 상세에서 이 PR을 연결해 주세요.</p>}</div><p className="work-demo-note">검토·CI·병합·배포는 서로 다른 상태입니다. 현재 표시되는 정보는 목데이터예요.</p>
  </div>
}
