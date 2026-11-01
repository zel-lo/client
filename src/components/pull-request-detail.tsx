import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, ChevronRight, CircleDot, ExternalLink, FileText, GitBranch, GitMerge, GitPullRequest, Pencil } from 'lucide-react'
import { activities } from '@/data/mock'
import type { Repo } from '@/data/mock'
import { repositoryRef } from '@/data/work-items'
import type { Issue, PullRequest } from '@/data/work-items'
import { getPullRequest, updateTeamSummary } from '../lib/project-api'
import type { PullRequestItem } from '../lib/project-api'
import { checkLabels, reviewSummary } from './pull-requests-panel'
import { MarkdownView } from './markdown'

export function PullRequestDetail({ pr, repos, issues, onViewIssue, canEdit = false, onChanged }: {
  pr: PullRequest; repos: Repo[]; issues: Issue[]; onViewIssue: (issue: Issue) => void; canEdit?: boolean; onChanged?: () => void;
}) {
  const [loaded, setLoaded] = useState<PullRequestItem | null>(null)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setEditing(false); setError('')
    if (!pr.live || !pr.projectId) return
    const controller = new AbortController()
    // 상세를 못 불러와도 목록에서 받은 내용으로 나머지는 그대로 보여준다.
    getPullRequest(pr.projectId, pr.id, controller.signal).then(setLoaded).catch(() => undefined)
    return () => controller.abort()
  }, [pr.id, pr.live, pr.projectId])
  const detail = loaded?.id === pr.id ? loaded : null
  const githubBody = detail?.body?.trim() ?? ''
  const activity = activities.find(item => item.id === pr.activityId)
  // 실제 PR은 zello의 팀 요약만 보여준다. GitHub 본문으로 대신 채우지 않는다.
  const summary = pr.live ? (detail ? detail.teamSummary ?? '' : pr.summary ?? '') : pr.summary || activity?.summary || ''
  const reviewers = detail ? detail.reviewers.map(item => item.login) : pr.reviewers ?? []

  async function save() {
    if (!detail || !pr.projectId) return
    setSaving(true); setError('')
    try {
      setLoaded(await updateTeamSummary(pr.projectId, pr.id, text, detail.version))
      setEditing(false)
      onChanged?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '요약을 저장하지 못했어요.')
    } finally { setSaving(false) }
  }
  const linked = issues.filter(issue => issue.pullRequestIds.includes(pr.id))
  return <div className="detail-content pr-detail"><span className={`event-icon large event-${pr.status === 'merged' ? 'merge' : 'pr'}`}>{pr.status === 'merged' ? <GitMerge size={24} /> : <GitPullRequest size={24} />}</span>
    <div className="detail-kicker"><span className="badge">{pr.status === 'merged' ? '병합됨' : pr.status === 'draft' ? '초안' : pr.status === 'closed' ? '닫힘' : '검토 요청'}</span><span className="mono muted">{repositoryRef(pr.repo, pr.number, repos)}</span></div><h2>{pr.title}</h2><div className="detail-author"><strong>{pr.author}</strong><span>{pr.live ? 'GitHub 연동' : '샘플 PR'}</span>{pr.url && <a className="subtle-link" href={pr.url} target="_blank" rel="noopener noreferrer">GitHub에서 보기</a>}</div>
    <div className="pr-branch-flow"><GitBranch size={14} /><code>{pr.branch}</code><ArrowRight size={13} /><code>{pr.base}</code></div>
    <section className="detail-summary" aria-label="팀을 위한 변경 요약">
      <div className="detail-summary-head"><span className="eyebrow">팀을 위한 변경 요약</span>{pr.live && canEdit && detail && !editing && <button type="button" className="subtle-link" onClick={() => { setText(summary); setError(''); setEditing(true) }}><Pencil size={12} />{summary ? '수정' : '작성하기'}</button>}</div>
      {editing
        ? <div className="summary-editor"><textarea aria-label="팀을 위한 변경 요약" rows={5} maxLength={10000} value={text} disabled={saving} onChange={event => setText(event.target.value)} placeholder="무엇을 바꿨고, 사용자가 어떤 차이를 확인할 수 있나요?" />
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="button" className="button" disabled={saving} onClick={() => setEditing(false)}>취소</button><button type="button" className="button button-dark" disabled={saving} onClick={() => void save()}>{saving ? '저장 중…' : '저장'}</button></div></div>
        : <p className={summary ? undefined : 'muted'}>{summary || '아직 작성되지 않았어요.'}</p>}
    </section>
    {githubBody && <section className="detail-summary detail-github-body" aria-label="GitHub PR 본문"><span className="eyebrow">GitHub PR 본문</span><MarkdownView source={githubBody} /></section>}
    {pr.live && pr.url && <p className="help-text"><ExternalLink size={12} />제목·본문·리뷰어는 <a className="subtle-link" href={pr.url} target="_blank" rel="noopener noreferrer">GitHub에서 수정</a>할 수 있어요.</p>}
    {activity && <div className="diff-summary" aria-label="변경 파일 요약"><div><strong>{activity.files}</strong><span>변경 파일</span></div><div><strong className="diff-add">+{activity.additions}</strong><span>추가한 줄</span></div><div><strong className="diff-delete">−{activity.deletions}</strong><span>삭제한 줄</span></div></div>}
    {!activity && <p className="help-text"><FileText size={12} />{pr.live ? '변경 파일 정보는 아직 수집하지 않아요. GitHub에서 확인해 주세요.' : '파일별 변경 내용은 실제 GitHub 연결 후 수집됩니다.'}</p>}
    <dl className="detail-properties"><div><dt>리뷰어</dt><dd>{reviewers.length ? reviewers.join(', ') : '지정되지 않았어요'}</dd></div><div><dt>코드 검토</dt><dd>{reviewSummary(pr)}</dd></div><div><dt>CI 검사</dt><dd className={`check-state check-${pr.checks}`}>{checkLabels[pr.checks]}</dd></div><div><dt>코드 병합</dt><dd>{pr.status === 'merged' ? <><CheckCircle2 size={13} />기본 브랜치에 반영됨</> : '아직 병합되지 않았어요'}</dd></div><div><dt>서비스 배포</dt><dd>{pr.live ? '수집 전' : activity?.deployed ? '배포 완료' : '아직 배포되지 않았어요'}</dd></div></dl>
    <div className="pr-linked-issues"><h3>이 변경으로 해결하는 이슈</h3>{linked.map(issue => <button className="command-item" key={issue.id} onClick={() => onViewIssue(issue)}><CircleDot size={14} /><span><small>{issue.id} · {repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)} · {issue.assignee || '담당자 미지정'}</small>{issue.title}</span><ChevronRight size={14} /></button>)}{!linked.length && <p className="help-text">연결된 이슈가 없어요. 할 일 상세에서 이 PR을 연결해 주세요.</p>}</div><p className="work-demo-note">검토·CI·병합·배포는 서로 다른 상태입니다. {pr.live ? 'CI와 배포 상태는 아직 수집하지 않아요.' : '현재 표시되는 정보는 목데이터예요.'}</p>
  </div>
}
