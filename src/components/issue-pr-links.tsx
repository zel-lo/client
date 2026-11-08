import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { changeIssuePullRequest, getIssue, listIssues, listPullRequests } from '../lib/project-api'
import type { LiveIssue, LinkedIssue, PullRequestItem } from '../lib/project-api'
import { LoadingState } from './loading-state'

/** Search and paging remain server-side so older issues can also be selected. */
export function IssuePicker({ projectId, repositoryId, selected, onChange, disabled = false }: {
  projectId: string; repositoryId: string; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<LiveIssue[]>([])
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setItems([])
    const timer = setTimeout(() => {
      listIssues(projectId, { repositoryId, query, page, size: 20 }, controller.signal).then(result => {
        if (controller.signal.aborted) return
        setItems(result.items); setHasNext(result.hasNext)
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '이슈를 불러오지 못했어요.') })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [projectId, repositoryId, query, page])
  return <fieldset className="issue-link-picker" disabled={disabled}><legend>관련 작업 <span className="optional">선택 · {selected.length}개 연결</span></legend>
    <input aria-label="연결할 작업 검색" placeholder="작업 제목 또는 번호 검색" value={query} onChange={event => { setQuery(event.target.value); setPage(1) }} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <LoadingState rows={2} label="연결할 작업을 불러오는 중" /> : <div className="pr-checklist">{items.map(issue => <label key={issue.id}><input type="checkbox" checked={selected.includes(issue.id)} disabled={disabled || selected.length >= 50 && !selected.includes(issue.id)} onChange={() => onChange(selected.includes(issue.id) ? selected.filter(id => id !== issue.id) : [...selected, issue.id])} /><span><strong>{issue.title}</strong><small>{issue.key}{issue.number ? ` · #${issue.number}` : ' · zello에만 저장됨'}</small></span></label>)}</div>}
    {!loading && !error && !items.length && <p className="help-text">연결할 작업이 없어요. 작업 연결 없이 요청을 만들거나, 팀 작업에서 먼저 등록할 수 있어요.</p>}
    {(page > 1 || hasNext) && <div className="connection-pagination"><button aria-label="이전 이슈" type="button" className="button" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={14} />이전</button><span>{page} 페이지</span><button aria-label="다음 이슈" type="button" className="button" disabled={loading || !hasNext} onClick={() => setPage(value => value + 1)}>다음<ChevronRight size={14} /></button></div>}
    <p className="help-text">이 코드 변경으로 해결하는 작업을 골라 주세요. 같은 저장소의 작업만 연결할 수 있어요.</p>
  </fieldset>
}

export function IssuePullRequestLinks({ projectId, issue, canWrite, disabled, onChanged, onBusyChange }: {
  projectId: string; issue: LiveIssue; canWrite: boolean; disabled: boolean; onChanged: (issue: LiveIssue) => void; onBusyChange: (busy: boolean) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [items, setItems] = useState<PullRequestItem[]>([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [pullId, setPullId] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!choosing) return
    const controller = new AbortController(); setLoading(true); setError(''); setPullId(''); setItems([])
    listPullRequests(projectId, { state: 'all', repositoryId: issue.repositoryId, page, size: 30 }, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setItems(result.items); setMore(result.hasNext)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'PR을 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, issue.repositoryId, choosing, page])
  async function change(id: string, linked: boolean) {
    setBusy(true); onBusyChange(true); setError('')
    try { const next = await changeIssuePullRequest(projectId, issue, id, linked); onChanged(next); setChoosing(false) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 저장하지 못했어요.') }
    finally { setBusy(false); onBusyChange(false) }
  }
  const links = issue.pullRequests ?? []
  return <section className="issue-pr-links" aria-label="연결된 PR"><h3>이 작업의 코드 검토</h3>
    {links.map(pull => <div className="linked-work-row" key={pull.id}><Link className="reference-link" to={`/pull-requests?pr=${encodeURIComponent(pull.id)}`}>#{pull.number} · {pull.title}</Link><span className="badge">{pull.state === 'MERGED' ? '병합됨' : pull.state === 'CLOSED' ? '닫힘' : pull.draft ? '초안' : pull.reviewDecision === 'CHANGES_REQUESTED' ? '수정 요청' : '검토 중'}</span>{canWrite && <button type="button" className="subtle-link" disabled={disabled || busy} onClick={() => void change(pull.id, false)}>연결 해제</button>}</div>)}
    {!links.length && <p className="help-text">아직 연결된 검토 요청이 없어요.</p>}
    {canWrite && !issue.archived && <div className="linked-work-actions"><button type="button" className="button" disabled={disabled || busy} onClick={() => setChoosing(value => !value)}>기존 검토 요청 연결</button>{!disabled && <Link className="button" to={`/pull-requests?createForIssue=${encodeURIComponent(issue.id)}`}>이 작업으로 검토 요청 만들기</Link>}</div>}
    {choosing && <div className="linked-work-actions"><select aria-label="연결할 PR" value={pullId} disabled={disabled || busy || loading} onChange={event => setPullId(event.target.value)}><option value="">{loading ? 'PR을 불러오는 중…' : 'PR 선택'}</option>{items.filter(p => p.repositoryId === issue.repositoryId && !links.some(link => link.id === p.id)).map(p => <option key={p.id} value={p.id}>#{p.number} · {p.title}</option>)}</select><button type="button" className="button" disabled={disabled || busy || !pullId} onClick={() => void change(pullId, true)}>선택한 PR 연결</button>{(page > 1 || more) && <><button aria-label="이전 PR" type="button" className="button" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={14} />이전</button><button aria-label="다음 PR" type="button" className="button" disabled={loading || !more} onClick={() => setPage(value => value + 1)}>다음<ChevronRight size={14} /></button></>}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="help-text">연결하면 PR의 초안·검토·병합 상태에 따라 작업 상태가 갱신돼요. 기존 검토 요청 연결·해제는 zello에 저장돼요.</p>
  </section>
}

export function PullRequestIssueLinks({ projectId, pullId, repositoryId, links, canWrite, onChanged }: {
  projectId: string; pullId: string; repositoryId: string; links: LinkedIssue[]; canWrite: boolean; onChanged: () => void
}) {
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function change(ids: string[], linked: boolean) {
    setBusy(true); setError('')
    try {
      for (const id of ids) {
        const issue = await getIssue(projectId, id)
        await changeIssuePullRequest(projectId, issue, pullId, linked)
      }
      setChoosing(false); setSelected([])
    } catch (cause) { setError(cause instanceof Error ? cause.message : '연결을 저장하지 못했어요.') }
    finally { onChanged(); setBusy(false) }
  }
  return <section className="issue-pr-links" aria-label="연결된 이슈"><h3>이 변경으로 해결하는 이슈</h3>
    {links.map(issue => <div className="linked-work-row" key={issue.id}><Link className="reference-link" to={`/issues?issue=${encodeURIComponent(issue.id)}`}>{issue.key}{issue.number ? ` · #${issue.number}` : ''} · {issue.title}</Link>{issue.archived && <span className="badge">보관됨</span>}{canWrite && <button type="button" className="subtle-link" disabled={busy} onClick={() => void change([issue.id], false)}>연결 해제</button>}</div>)}
    {!links.length && <p className="help-text">연결된 이슈가 없어요.</p>}
    {canWrite && <button type="button" className="button" disabled={busy} onClick={() => setChoosing(value => !value)}>이슈 연결</button>}
    {choosing && <><IssuePicker projectId={projectId} repositoryId={repositoryId} selected={selected} onChange={setSelected} disabled={busy} /><button type="button" className="button" disabled={busy || !selected.length} onClick={() => void change(selected, true)}>선택한 이슈 연결</button></>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="help-text">기존 검토 요청 연결·해제는 zello에 저장돼요. GitHub 본문의 자동 닫기 참조는 GitHub에서 수정해 주세요.</p>
  </section>
}
