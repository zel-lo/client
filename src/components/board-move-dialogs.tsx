import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, GitBranch, GitPullRequest, RefreshCw } from 'lucide-react'
import { changeIssuePullRequest, getIssue, listAssignees, publishIssue, updateIssue, listPullRequests, startIssueWorkBranch, syncPullRequests, ProjectApiError } from '../lib/project-api'
import { ActionContext, InlineExplanation } from './workflow-help'
import { projectWeeks, startOfWeek, weekLabel } from '../lib/work-weeks'
import type { IssueWorkBranch, LiveIssue, PullRequestItem, Project } from '../lib/project-api'

/** 보드에서 옮기기 전에 최신 작업을 다시 읽는다. 그사이 다른 사람이 단계를 바꿨으면 멈춘다. */
async function latestFor(projectId: string, issue: LiveIssue) {
  const latest = await getIssue(projectId, issue.id)
  if (latest.status !== issue.status || latest.archived) throw new ProjectApiError('다른 변경이 있어요. 최신 작업을 확인한 뒤 다시 시도해 주세요.', 'ISSUE_CHANGED')
  return latest
}

function useMounted() {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  return mounted
}

/** 할 일에서 배정과 발행을 마친 뒤에만 진행 중으로 옮긴다. 발행 재시도는 기존 요청 키를 사용한다. */
export function ActivateIssuePanel({ project, issue, week, initialAssignee, placement, onBusyChange, onActivated, onRefresh, onClose }: {
  project: Project; issue: LiveIssue; week: string; initialAssignee?: string | null; placement?: { beforeId: string | null }
  onBusyChange: (busy: boolean) => void; onActivated: (issue: LiveIssue) => void
  onRefresh: (issue: LiveIssue) => void; onClose: () => void
}) {
  const [assignee, setAssignee] = useState(initialAssignee ?? issue.assignee ?? '')
  const [plannedWeek, setPlannedWeek] = useState(week)
  const [people, setPeople] = useState<{ login: string }[]>([])
  const [page, setPage] = useState(1), [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true), [loadError, setLoadError] = useState(''), [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [started, setStarted] = useState<LiveIssue | null>(null)
  const mounted = useMounted()
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setLoadError('')
    listAssignees(project.id, issue.repositoryId, page, controller.signal).then(result => {
      if (!controller.signal.aborted) { setPeople(current => [...new Map((page === 1 ? result.items : [...current, ...result.items]).map(person => [person.login, person])).values()]); setHasNext(result.hasNext) }
    }).catch(cause => { if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : '담당자를 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [project.id, issue.repositoryId, page, retry])
  async function activate() {
    if (busy || !assignee) return
    setBusy(true); onBusyChange(true); setError('')
    try {
      let current = await latestFor(project.id, issue)
      const details = (row: LiveIssue) => ({ title: row.title, description: row.description ?? '', acceptanceCriteria: row.acceptanceCriteria ?? '', status: row.status, priority: row.priority, source: row.source, meetingDate: row.meetingDate, meetingContext: row.meetingContext ?? '', assignee, plannedWeekStart: plannedWeek })
      // UNKNOWN/PENDING must be reconciled before any edit. Publishing again adopts the existing GitHub issue.
      if (!['PUBLISHED', 'PENDING', 'UNKNOWN'].includes(current.publishStatus)) {
        current = await updateIssue(project.id, current, details(current), current.githubState)
      }
      if (current.publishStatus !== 'PUBLISHED') current = await publishIssue(project.id, current)
      if (current.archived || current.status !== issue.status || current.githubState === 'CLOSED') throw new ProjectApiError('작업 상태가 바뀌었어요. 최신 작업을 확인해 주세요.', 'ISSUE_CHANGED')
      current = await updateIssue(project.id, current, { ...details(current), status: 'IN_PROGRESS' }, 'OPEN', placement)
      if (!mounted.current) return
      setStarted(current); onActivated(current)
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '이슈를 만들지 못했어요.')
      // A GitHub write may have succeeded despite a lost response. Keep the card's persisted state and retry the same ID.
      try {
        const current = await getIssue(project.id, issue.id)
        if (mounted.current) {
          if (!current.archived && current.publishStatus === 'PUBLISHED' && current.githubState === 'OPEN' && current.status === 'IN_PROGRESS' && current.assignee === assignee && current.plannedWeekStart === plannedWeek) {
            setStarted(current); setError(''); onActivated(current)
          } else onRefresh(current)
        }
      } catch { /* Keep inputs and original error. */ }
    } finally { onBusyChange(false); if (mounted.current) setBusy(false) }
  }
  if (started) return <StartWorkPanel projectId={project.id} issue={started} onBusyChange={onBusyChange} onStarted={onRefresh} onClose={onClose} />
  const weeks = projectWeeks(project)
  return <form className="dialog-form board-move-panel" onSubmit={event => { event.preventDefault(); void activate() }}>
    <p><strong>{issue.key} {issue.title}</strong></p><ActionContext title="담당자를 정하고 진행을 시작해요" destination="github">아래 담당자와 주차로 작업을 시작해요. GitHub에도 개발할 내용을 기록한 작업(이슈)이 연결돼요.</ActionContext>
    <label>연결 저장소<input readOnly value={`${issue.repositoryOwner}/${issue.repositoryName}`} /></label>
    <label>담당자<select required value={assignee} disabled={busy || loading} onChange={event => setAssignee(event.target.value)}><option value="">담당자를 선택해 주세요</option>{assignee && !people.some(person => person.login === assignee) && <option value={assignee}>{assignee}</option>}{people.map(person => <option key={person.login} value={person.login}>{person.login}</option>)}</select></label>
    {loading && <p className="help-text" role="status">담당자를 불러오는 중…</p>}{loadError && <p className="form-error" role="alert">{loadError}<button type="button" className="subtle-link" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></p>}
    {hasNext && <button type="button" className="button" disabled={busy || loading} onClick={() => setPage(value => value + 1)}>담당자 더 보기</button>}
    <label>계획 주차{weeks.length ? <select value={plannedWeek} disabled={busy} onChange={event => setPlannedWeek(event.target.value)}>{weeks.map((value, index) => <option key={value} value={value}>{index + 1}주차 · {weekLabel(value, project)}</option>)}</select> : <input required type="date" value={plannedWeek} disabled={busy} onChange={event => { if (event.target.value) setPlannedWeek(startOfWeek(event.target.value)) }} />}</label>
    <p className="help-text">{issue.publishStatus === 'PUBLISHED' ? '기존 GitHub 이슈에 담당자를 반영하고 진행 중으로 옮겨요.' : '이슈가 만들어지면 진행 중으로 옮겨요. 브랜치는 다음 단계에서 선택할 수 있어요.'}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>취소</button><button className="button button-dark" disabled={busy || loading || !assignee}><GitPullRequest size={14} />{busy ? '배정하고 이슈 확인 중…' : issue.publishStatus === 'PUBLISHED' ? '배정하고 진행 중으로' : '배정하고 이슈 만들기'}</button></div>
  </form>
}

/** 이슈 준비가 끝나면 선택해서 작업 브랜치를 만든다. */
export function StartWorkPanel({ projectId, issue, onBusyChange, onStarted, onClose }: {
  projectId: string; issue: LiveIssue; onBusyChange: (busy: boolean) => void
  onStarted: (issue: LiveIssue) => void; onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [branch, setBranch] = useState<IssueWorkBranch | null>(null)
  const [copied, setCopied] = useState(false)
  const mounted = useMounted()
  const name = `feat/${issue.number}`
  async function start() {
    setBusy(true); onBusyChange(true); setError('')
    try {
      const result = await startIssueWorkBranch(projectId, await latestFor(projectId, issue))
      if (!mounted.current) return
      setBranch(result); onStarted(result.issue)
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '작업을 시작하지 못했어요.') }
    finally { onBusyChange(false); if (mounted.current) setBusy(false) }
  }
  async function copy() {
    if (!branch) return
    try { await navigator.clipboard.writeText(branch.commands); setCopied(true); setError('') }
    catch { setCopied(false); setError('자동 복사가 되지 않았어요. 아래 명령어를 선택해 복사해 주세요.') }
  }
  if (branch) return <div className="dialog-form board-move-panel">
    <p className="connection-notice" role="status">{branch.created ? `GitHub에 ${branch.name} 브랜치를 준비했어요.` : `기존 ${branch.name} 브랜치를 준비했어요.`}</p>
    <p className="help-text">이 저장소가 있는 로컬 폴더의 터미널에서 실행해 주세요.</p>
    <pre className="work-branch-commands" aria-label="작업 브랜치 전환 명령어"><code>{branch.commands}</code></pre>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><a className="subtle-link" href={branch.url} target="_blank" rel="noopener noreferrer">GitHub에서 브랜치 보기<ExternalLink size={12} /></a><button type="button" className="button" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '복사했어요' : 'Git 명령어 복사'}</button><button type="button" className="button button-dark" onClick={onClose}>확인</button></div>
  </div>
  return <div className="dialog-form board-move-panel">
    <p><strong>{issue.key} {issue.title}</strong></p>
    <ActionContext title="작업이 진행 중으로 바뀌었어요">담당자 배정과 GitHub 이슈 연결을 마쳤어요. 아래는 개발을 직접 맡은 사람을 위한 선택 단계예요.</ActionContext><InlineExplanation title="작업 브랜치가 무엇인가요?"><p className="help-text">브랜치는 기존 코드에서 나눠 이 작업을 개발할 공간이에요. 개발을 마치면 이 브랜치의 코드로 검토를 요청해요.</p></InlineExplanation><p className="help-text"><code>{name}</code> 이름을 사용하고, 같은 이름의 브랜치가 있으면 이어서 작업해요.</p>
    <p className="help-text">브랜치를 만들어 두면 코드 검토 요청을 만들 때 자동으로 선택돼요. 지금 건너뛰어도 작업 상세에서 준비할 수 있어요.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>지금은 건너뛰기</button><button type="button" className="button button-dark" disabled={busy} onClick={() => void start()}><GitBranch size={14} />{busy ? '브랜치 만드는 중…' : '브랜치 만들기'}</button></div>
  </div>
}

/** 작업 브랜치에서 올린 PR을 맨 앞에 둔다. */
function recommended(pull: PullRequestItem, issue: LiveIssue) {
  return !!pull.headBranch && (pull.headBranch === issue.workBranch || (!!issue.number && pull.headBranch === `feat/${issue.number}`))
}

/** 진행 중 → 검토 중. 검토받을 PR을 연결하면 PR 상태로 단계가 정해진다. */
export function LinkPullRequestPanel({ projectId, issue, onBusyChange, onLinked, onClose }: {
  projectId: string; issue: LiveIssue; onBusyChange: (busy: boolean) => void
  onLinked: (issue: LiveIssue, pull: PullRequestItem) => void; onClose: () => void
}) {
  const [pulls, setPulls] = useState<PullRequestItem[] | null>(null)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const mounted = useMounted()
  useEffect(() => {
    const controller = new AbortController(); setPulls(null); setError('')
    listPullRequests(projectId, { state: 'open', repositoryId: issue.repositoryId, size: 50 }, controller.signal).then(result => {
      if (controller.signal.aborted) return
      const linked = new Set((issue.pullRequests ?? []).map(pull => pull.id))
      const items = result.items.filter(pull => pull.repositoryId === issue.repositoryId && !linked.has(pull.id))
        .sort((a, b) => Number(recommended(b, issue)) - Number(recommended(a, issue)))
      setPulls(items)
      setSelected(current => items.some(pull => pull.id === current) ? current : items.find(pull => recommended(pull, issue))?.id ?? (items.length === 1 ? items[0].id : ''))
    }).catch(cause => { if (!controller.signal.aborted) { setPulls([]); setError(cause instanceof Error ? cause.message : 'PR을 불러오지 못했어요.') } })
    return () => controller.abort()
  }, [projectId, issue, revision])
  async function sync() {
    setSyncing(true); setError('')
    try { await syncPullRequests(projectId); if (mounted.current) setRevision(value => value + 1) }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'GitHub PR을 가져오지 못했어요.') }
    finally { if (mounted.current) setSyncing(false) }
  }
  async function link() {
    const pull = pulls?.find(item => item.id === selected)
    if (!pull) return
    setBusy(true); onBusyChange(true); setError('')
    try {
      const next = await changeIssuePullRequest(projectId, await latestFor(projectId, issue), pull.id, true)
      if (mounted.current) onLinked(next, pull)
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'PR을 연결하지 못했어요.') }
    finally { onBusyChange(false); if (mounted.current) setBusy(false) }
  }
  const chosen = pulls?.find(pull => pull.id === selected)
  return <div className="dialog-form board-move-panel">
    <p>검토 중은 팀의 확인을 기다리는 PR이 있는 단계예요. <strong>{issue.key}</strong>을 해결하는 PR을 골라 주세요.</p>
    {!pulls ? <p className="help-text" role="status">열린 PR을 불러오는 중…</p> : pulls.length ? <div className="pr-checklist" role="radiogroup" aria-label="검토받을 PR">{pulls.map(pull => <label key={pull.id}><input type="radio" name="board-link-pull" value={pull.id} checked={selected === pull.id} disabled={busy} onChange={() => setSelected(pull.id)} /><span><strong>#{pull.number} {pull.title}{recommended(pull, issue) && <span className="board-move-recommend">작업 브랜치</span>}</strong><small className="mono">{pull.headBranch} → {pull.baseBranch} · {pull.draft ? '초안' : pull.reviewDecision === 'CHANGES_REQUESTED' ? '수정 요청' : pull.reviewDecision === 'APPROVED' ? '승인됨' : '검토 대기'}</small></span></label>)}</div>
      : <p className="help-text">{issue.repositoryName} 저장소에 연결할 수 있는 열린 PR이 없어요. 개발한 코드를 GitHub에 올린 뒤 검토 요청을 만들어 주세요.</p>}
    {chosen && (chosen.draft || chosen.reviewDecision === 'CHANGES_REQUESTED') && <p className="help-text">{chosen.draft ? '초안 PR이라 연결해도 진행 중에 남아요. GitHub에서 Ready for review로 바꾸면 검토 중으로 옮겨져요.' : '수정 요청을 받은 PR이라 연결해도 진행 중에 남아요. 수정 후 다시 검토를 받으면 검토 중으로 옮겨져요.'}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="subtle-link" disabled={busy || syncing} onClick={() => void sync()}><RefreshCw size={12} className={syncing ? 'board-saving' : ''} />{syncing ? 'GitHub 확인 중…' : 'GitHub PR 다시 가져오기'}</button><button type="button" className="button" disabled={busy} onClick={onClose}>취소</button><Link className="button" to={`/pull-requests?createForIssue=${encodeURIComponent(issue.id)}`}>이 작업으로 검토 요청 만들기</Link><button type="button" className="button button-dark" disabled={busy || !chosen} onClick={() => void link()}><GitPullRequest size={14} />{busy ? '연결하는 중…' : 'PR 연결'}</button></div>
  </div>
}
