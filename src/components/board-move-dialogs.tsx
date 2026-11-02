import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, ExternalLink, GitBranch, GitPullRequest, RefreshCw } from 'lucide-react'
import { changeIssuePullRequest, getIssue, listPullRequests, startIssueWorkBranch, syncPullRequests, ProjectApiError } from '../lib/project-api'
import type { IssueWorkBranch, LiveIssue, PullRequestItem } from '../lib/project-api'

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

/** 이번에 할 일 → 작업 중. 이슈 번호로 작업 브랜치를 만들고 진행 중으로 옮긴다. */
export function StartWorkPanel({ projectId, issue, onBusyChange, onPlainMove, onStarted, onClose }: {
  projectId: string; issue: LiveIssue; onBusyChange: (busy: boolean) => void
  onPlainMove: () => void; onStarted: (issue: LiveIssue) => void; onClose: () => void
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
    <p className="connection-notice" role="status">{branch.created ? `GitHub에 ${branch.name} 브랜치를 만들고 작업 중으로 옮겼어요.` : `기존 ${branch.name} 브랜치로 작업 중으로 옮겼어요.`}</p>
    <p className="help-text">이 저장소가 있는 로컬 폴더의 터미널에서 실행해 주세요.</p>
    <pre className="work-branch-commands" aria-label="작업 브랜치 전환 명령어"><code>{branch.commands}</code></pre>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><a className="subtle-link" href={branch.url} target="_blank" rel="noopener noreferrer">GitHub에서 브랜치 보기<ExternalLink size={12} /></a><button type="button" className="button" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '복사했어요' : 'Git 명령어 복사'}</button><button type="button" className="button button-dark" onClick={onClose}>확인</button></div>
  </div>
  return <div className="dialog-form board-move-panel">
    <p><strong>{issue.key} {issue.title}</strong></p>
    <p>GitHub에 <code>{name}</code> 브랜치를 만들고 작업 중으로 옮겨요. 같은 이름의 브랜치가 있으면 그 브랜치를 그대로 써요.</p>
    <p className="help-text">브랜치를 만들어 두면 PR을 작성할 때 이 브랜치가 미리 선택되고, PR 상태에 따라 단계가 자동으로 바뀌어요.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={onClose}>취소</button><button type="button" className="button" disabled={busy} onClick={onPlainMove}>브랜치 없이 옮기기</button><button type="button" className="button button-dark" disabled={busy} onClick={() => void start()}><GitBranch size={14} />{busy ? '브랜치 만드는 중…' : '브랜치 만들고 시작'}</button></div>
  </div>
}

/** 작업 브랜치에서 올린 PR을 맨 앞에 둔다. */
function recommended(pull: PullRequestItem, issue: LiveIssue) {
  return !!pull.headBranch && (pull.headBranch === issue.workBranch || (!!issue.number && pull.headBranch === `feat/${issue.number}`))
}

/** 작업 중 → 검토 중. 검토받을 PR을 연결하면 PR 상태로 단계가 정해진다. */
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
      : <p className="help-text">{issue.repositoryName} 저장소에 연결할 수 있는 열린 PR이 없어요. 작업 브랜치를 push한 뒤 PR을 작성해 주세요.</p>}
    {chosen && (chosen.draft || chosen.reviewDecision === 'CHANGES_REQUESTED') && <p className="help-text">{chosen.draft ? '초안 PR이라 연결해도 작업 중에 남아요. GitHub에서 Ready for review로 바꾸면 검토 중으로 옮겨져요.' : '수정 요청을 받은 PR이라 연결해도 작업 중에 남아요. 수정 후 다시 검토를 받으면 검토 중으로 옮겨져요.'}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button type="button" className="subtle-link" disabled={busy || syncing} onClick={() => void sync()}><RefreshCw size={12} className={syncing ? 'board-saving' : ''} />{syncing ? 'GitHub 확인 중…' : 'GitHub PR 다시 가져오기'}</button><button type="button" className="button" disabled={busy} onClick={onClose}>취소</button><Link className="button" to={`/pull-requests?createForIssue=${encodeURIComponent(issue.id)}`}>이 작업으로 새 PR 작성</Link><button type="button" className="button button-dark" disabled={busy || !chosen} onClick={() => void link()}><GitPullRequest size={14} />{busy ? '연결하는 중…' : 'PR 연결'}</button></div>
  </div>
}
