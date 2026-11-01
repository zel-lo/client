import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, ArrowUpRight, CircleDot, Github, Plus, RefreshCw, X } from 'lucide-react'
import { archiveIssue, createIssue, getIssue, listAssignees, listConnectedRepositories, listIssues, publishIssue, restoreIssue, syncIssues, updateIssue, ProjectApiError } from '../lib/project-api'
import type { ConnectedRepository, IssueDetails, IssuePage, LiveIssue, Project } from '../lib/project-api'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

const states: Record<IssueDetails['status'], string> = { BACKLOG: '백로그', TODO: '할 일', IN_PROGRESS: '진행 중', IN_REVIEW: '검토 중', DONE: '완료' }
const sources: Record<IssueDetails['source'], string> = { REQUEST: '수시 요청', DAILY: '데일리 스크럼', WEEKLY: '주간 회의', GITHUB: 'GitHub에서 가져옴' }
const priorities = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }
const publication = { LOCAL: 'zello에 저장됨', PENDING: 'GitHub 발행 중', PUBLISHED: 'GitHub에 발행됨', FAILED: 'GitHub 발행 실패', UNKNOWN: 'GitHub 발행 확인 필요' }
const reauthCodes = ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE']
const blank = (): IssueDetails => ({ title: '', description: '', acceptanceCriteria: '', status: 'TODO', priority: 'MEDIUM', source: 'REQUEST', meetingDate: null, meetingContext: '', assignee: null })

function detailsFor(issue: LiveIssue): IssueDetails {
  return { title: issue.title, description: issue.description ?? '', status: issue.status, priority: issue.priority, source: issue.source,
    meetingDate: issue.meetingDate, meetingContext: issue.meetingContext ?? '', acceptanceCriteria: issue.acceptanceCriteria ?? '', assignee: issue.assignee }
}

function IssueDialog({ children, busy, onClose }: { children: ReactNode; busy: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose); close.current = onClose
  const pending = useRef(busy); pending.current = busy
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending.current) close.current()
      if (event.key !== 'Tab') return
      const nodes = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')
      if (!nodes?.length) { event.preventDefault(); return }
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (event.shiftKey && [first, panel.current].includes(document.activeElement as HTMLElement)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && [last, panel.current].includes(document.activeElement as HTMLElement)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); before?.focus() }
  }, [])
  return <div className="dialog-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose() }}><div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-label="작업 상세" ref={panel} tabIndex={-1}><div className="dialog-header"><span className="eyebrow">회의에서 정한 일부터 실제 개발까지</span><button type="button" className="icon-button" aria-label="작업 창 닫기" disabled={busy} onClick={onClose}><X size={20} /></button></div>{children}</div></div>
}

export function LiveIssues({ project, projectLoading = false, mineOnly = false, onCountChange }: { project: Project | null; projectLoading?: boolean; mineOnly?: boolean; onCountChange?: (total: number) => void }) {
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState<IssuePage | null>(null)
  const [repositories, setRepositories] = useState<ConnectedRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reauth, setReauth] = useState(false)
  const [revision, setRevision] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<LiveIssue | 'new' | null>(null)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [archived, setArchived] = useState(false)
  const [mine, setMine] = useState(mineOnly)
  const [page, setPage] = useState(1)
  const request = useRef<AbortController | null>(null)
  const scope = useRef(project?.id); scope.current = project?.id
  const canWrite = !!project && project.role !== 'VIEWER'

  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : '작업을 처리하지 못했어요.')
    setReauth(cause instanceof ProjectApiError && reauthCodes.includes(cause.code))
  }
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(queryInput); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [queryInput])
  useEffect(() => {
    const updated = () => setRevision(value => value + 1)
    const failed = (event: Event) => { const detail = (event as CustomEvent<{ projectId: string; message: string }>).detail; if (detail.projectId === scope.current) setError(detail.message) }
    window.addEventListener('zello:issues-updated', updated)
    window.addEventListener('zello:issues-sync-error', failed)
    return () => { window.removeEventListener('zello:issues-updated', updated); window.removeEventListener('zello:issues-sync-error', failed) }
  }, [])
  useEffect(() => { setEditing(null); setResult(null); setRepositories([]); setPage(1); setError(''); setNotice('') }, [project?.id])
  useEffect(() => {
    if (!project) { setLoading(false); return }
    const controller = new AbortController(); request.current = controller
    setLoading(true); setError(''); setReauth(false)
    void Promise.all([
      listIssues(project.id, { query, status, page, archived, mine, activeOnly: mineOnly }, controller.signal),
      listConnectedRepositories(project.id, controller.signal),
    ]).then(([issues, repos]) => { if (!controller.signal.aborted) { setResult(issues); setRepositories(repos) } })
      .catch(cause => { if (!controller.signal.aborted) { setResult(null); report(cause) } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [project?.id, query, status, page, archived, mine, mineOnly, revision])
  useEffect(() => { if (result && !query && !status && !archived && mine === mineOnly) onCountChange?.(result.total) }, [result, query, status, archived, mine, mineOnly, onCountChange])
  useEffect(() => {
    if (params.get('new') === '1' && project && !loading && canWrite) {
      setEditing('new'); setParams(current => { current.delete('new'); return current }, { replace: true })
    }
  }, [params, project, loading, canWrite, setParams])

  async function open(issue: LiveIssue) {
    if (!project) return
    const id = project.id
    setBusy(true); setError('')
    try { const current = await getIssue(id, issue.id); if (scope.current === id) setEditing(current) }
    catch (cause) { if (scope.current === id) report(cause) } finally { setBusy(false) }
  }
  async function sync() {
    if (!project || syncing) return
    const id = project.id
    setSyncing(true); setError(''); setNotice('')
    try {
      const result = await syncIssues(id)
      if (scope.current !== id) return
      setNotice(`${result.collected}개 이슈를 확인했어요.${result.skippedRepositories ? ` 접근할 수 없는 저장소 ${result.skippedRepositories}개는 건너뛰었어요.` : ''}${result.hasMore ? ' 최근 수정된 1,000개까지만 가져왔어요.' : ''}`)
      setRevision(value => value + 1)
    } catch (cause) { if (scope.current === id) report(cause) } finally { setSyncing(false) }
  }
  if (projectLoading && !project) return <p role="status">프로젝트를 불러오는 중…</p>
  if (!project) return <div className="empty-state"><Github size={28} /><h2>팀의 저장소로 시작해요</h2><p>저장소를 연결하면 회의에서 정한 작업을 저장하고 GitHub에 발행할 수 있어요.</p><Link className="button button-dark" to="/onboarding">프로젝트와 저장소 연결</Link></div>

  return <section className="live-issues" aria-label={mineOnly ? '실제 맡은 작업' : '실제 팀 작업'}>
    <div className="section-heading"><h2>{mineOnly ? '내가 맡은 작업' : '팀의 작업'} <span className="count-text">{result?.total ?? 0}</span></h2><div className="issue-actions"><button className="button" disabled={syncing || busy} onClick={() => void sync()}><RefreshCw size={14} />{syncing ? 'GitHub 확인 중…' : 'GitHub 이슈 가져오기'}</button>{canWrite && <button className="button button-dark" disabled={busy} onClick={() => { setError(''); setEditing('new') }}><Plus size={14} />새 작업 등록</button>}</div></div>
    {error && <div className="connection-error" role="alert">{error}{reauth ? <Link to="/login?reauth=github">GitHub 다시 로그인</Link> : <button className="button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button>}</div>}
    {notice && <p className="connection-notice" role="status">{notice}</p>}
    <div className="work-filters">
      <label>작업 검색<input type="search" value={queryInput} onChange={event => setQueryInput(event.target.value)} placeholder="제목 또는 작업 번호" /></label>
      <label>진행 상태<select value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">모든 상태</option>{Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>작업 목록<select value={archived ? 'archived' : 'active'} onChange={event => { setArchived(event.target.value === 'archived'); setPage(1) }}><option value="active">진행·완료한 작업</option><option value="archived">보관한 작업</option></select></label>
      {!mineOnly && <label className="inline-checkbox"><input type="checkbox" checked={mine} onChange={event => { setMine(event.target.checked); setPage(1) }} />내가 맡은 작업만</label>}
    </div>
    {loading && !result ? <p role="status">저장한 작업을 불러오는 중…</p> : result && <>
      <div className="data-frame"><Table><TableHeader><TableRow><TableHead>작업 / 등록 경로</TableHead><TableHead>상태</TableHead><TableHead>담당자</TableHead><TableHead>우선순위</TableHead><TableHead>GitHub 발행</TableHead></TableRow></TableHeader><TableBody>{result.items.map(issue => <TableRow key={issue.id}>
        <TableCell><button className="issue-title" disabled={busy} onClick={() => void open(issue)}><CircleDot size={15} /><span>{issue.title}<small>{issue.number ? `${issue.repositoryOwner}/${issue.repositoryName}#${issue.number}` : issue.key} · {sources[issue.source]}{issue.meetingDate ? ` · ${issue.meetingDate}` : ''}</small></span></button></TableCell>
        <TableCell><span className={`issue-status-badge issue-status-${issue.status.toLowerCase()}`}>{states[issue.status]}</span>{issue.githubState === 'CLOSED' && <small className="muted"> · GitHub 닫힘</small>}</TableCell>
        <TableCell>{issue.assignee ?? '지정 필요'}</TableCell><TableCell>{priorities[issue.priority]}</TableCell><TableCell><span className="badge">{publication[issue.publishStatus]}</span></TableCell>
      </TableRow>)}</TableBody></Table></div>
      {!result.items.length && <div className="empty-state"><CircleDot size={25} /><h3>{archived ? '보관한 작업이 없어요' : '아직 표시할 작업이 없어요'}</h3><p>{repositories.length ? '새 작업을 등록하거나 GitHub의 기존 이슈를 가져오세요.' : '먼저 프로젝트에 저장소를 연결해 주세요.'}</p>{!repositories.length && <Link className="button" to="/settings?tab=repositories">저장소 연결</Link>}</div>}
      <div className="connection-pagination"><button className="button" disabled={page === 1} onClick={() => setPage(value => value - 1)}>이전 작업</button><span>{page} 페이지</span><button className="button" disabled={!result.hasNext} onClick={() => setPage(value => value + 1)}>다음 작업</button></div>
    </>}
    <p className="help-text">새 작업은 기본으로 zello에 저장한 뒤 선택한 GitHub 저장소에도 만듭니다. zello에만 저장한 작업은 상세에서 발행할 수 있어요.</p>
    {editing && <IssueEditor  projectId={project.id} issue={editing === 'new' ? null : editing} repositories={repositories} canWrite={canWrite} onClose={() => setEditing(null)} onChanged={item => { setEditing(item); setRevision(value => value + 1) }} onArchived={() => { setEditing(null); setRevision(value => value + 1); setNotice(archived ? '작업을 복원했어요.' : '작업을 보관했어요. GitHub 원본은 유지됩니다.') }} />}
  </section>
}

function IssueEditor({ projectId, issue, repositories, canWrite, onClose, onChanged, onArchived }: {
  projectId: string; issue: LiveIssue | null; repositories: ConnectedRepository[]; canWrite: boolean
  onClose: () => void; onChanged: (issue: LiveIssue) => void; onArchived: () => void
}) {
  const [form, setForm] = useState<IssueDetails>(issue ? detailsFor(issue) : blank())
  const [repoId, setRepoId] = useState(issue?.repositoryId ?? repositories[0]?.id ?? '')
  const [githubState, setGithubState] = useState<LiveIssue['githubState']>(issue?.githubState ?? 'OPEN')
  const [assignees, setAssignees] = useState<{ login: string }[]>([])
  const [assigneesLoading, setAssigneesLoading] = useState(false)
  const [assigneesPage, setAssigneesPage] = useState(1)
  const [assigneesMore, setAssigneesMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [stale, setStale] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [publishAfterSave, setPublishAfterSave] = useState(true)
  const key = useRef(crypto.randomUUID())
  const unresolved = issue?.publishStatus === 'PENDING' || issue?.publishStatus === 'UNKNOWN'
  const disabled = !canWrite || busy || !!issue?.archived || unresolved
  const dirty = issue && (Object.keys(form) as (keyof IssueDetails)[]).some(key => (form[key] ?? '') !== (issue[key] ?? ''))
  const meeting = form.source === 'DAILY' || form.source === 'WEEKLY'
  const valid = form.title.trim() && repoId && (!meeting || form.meetingDate)
  useEffect(() => {
    if (!repoId || !canWrite) return
    const controller = new AbortController(); setAssigneesLoading(true)
    void listAssignees(projectId, repoId, assigneesPage, controller.signal).then(people => {
      if (!controller.signal.aborted) { setAssignees(current => assigneesPage === 1 ? people.items : [...current, ...people.items]); setAssigneesMore(people.hasNext) }
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '담당자를 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setAssigneesLoading(false) })
    return () => controller.abort()
  }, [projectId, repoId, assigneesPage, canWrite])
  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : '작업을 저장하지 못했어요.')
    setStale(cause instanceof ProjectApiError && cause.code === 'ISSUE_CHANGED')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || disabled || stale) return
    setBusy(true); setError(''); setNotice('')
    let saved: LiveIssue | null = null
    try {
      saved = issue ? await updateIssue(projectId, issue, form, githubState) : await createIssue(projectId, repoId, form, key.current)
      // Keep the same editor mounted until publication resolves; otherwise the saved ID remounts it mid-request.
      if (!issue && publishAfterSave) saved = await publishIssue(projectId, saved)
      setForm(detailsFor(saved)); setGithubState(saved.githubState); onChanged(saved)
      setNotice(saved.publishStatus === 'PUBLISHED' ? 'GitHub에 이슈를 만들었어요.' : 'zello에 저장했어요. GitHub에는 아직 만들어지지 않았어요.')
    } catch (cause) {
      if (saved && !issue) {
        // Local persistence succeeded. Reopen the saved row, including the server's failed/unknown outcome.
        let current = saved
        try { current = await getIssue(projectId, saved.id) } catch { /* Retain the known local row. */ }
        onChanged(current)
      }
      report(cause)
    } finally { setBusy(false) }
  }
  async function publish() {
    if (!issue || busy) return
    setBusy(true); setError('')
    try { const saved = await publishIssue(projectId, issue); setForm(detailsFor(saved)); setGithubState(saved.githubState); onChanged(saved); setNotice('GitHub에 이슈를 발행했어요.') }
    catch (cause) {
      report(cause)
      // Persisted publish status/version may have changed even if the upstream request failed.
      try { onChanged(await getIssue(projectId, issue.id)) } catch { /* Keep the error and allow a later refresh. */ }
    } finally { setBusy(false) }
  }
  async function archive() {
    if (!issue || busy) return
    setBusy(true); setError('')
    try { if (issue.archived) await restoreIssue(projectId, issue); else await archiveIssue(projectId, issue); onArchived() }
    catch (cause) { report(cause) } finally { setBusy(false) }
  }
  return <IssueDialog onClose={onClose} busy={busy}><form className="dialog-form" onSubmit={event => void submit(event)}>
    <h2>{issue ? issue.title : '새 작업 등록'}</h2>
    {issue && <p><span className="badge">{publication[issue.publishStatus]}</span> <span className="mono muted">{issue.key}</span>{issue.url && <a className="reference-link" href={issue.url} target="_blank" rel="noopener noreferrer">GitHub에서 보기<ArrowUpRight size={13} /></a>}</p>}
    {!canWrite && <p className="help-text">조회 전용 멤버는 작업을 변경할 수 없어요.</p>}
    <label>연결 저장소<select required value={repoId} disabled={disabled || !!issue} onChange={event => { setRepoId(event.target.value); setAssigneesPage(1); setAssignees([]); setForm(current => ({ ...current, assignee: null })) }}>{!repoId && <option value="">저장소 선택</option>}{repositories.map(repo => <option key={repo.id} value={repo.id}>{repo.owner}/{repo.name}</option>)}</select></label>
    {!repositories.length && <Link className="reference-link" to="/settings?tab=repositories">먼저 저장소 연결하기</Link>}
    <label>작업 제목<input autoFocus required maxLength={255} value={form.title} disabled={disabled} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="어떤 작업을 할까요?" /></label>
    <label>설명<textarea rows={4} maxLength={50000} value={form.description} disabled={disabled} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="배경과 해야 할 일을 적어주세요." /></label>
    <label>완료 조건<textarea rows={3} maxLength={10000} value={form.acceptanceCriteria} disabled={disabled} onChange={event => setForm({ ...form, acceptanceCriteria: event.target.value })} placeholder="- [ ] 어떤 결과를 확인하면 완료인가요?" /></label>
    <div className="issue-fields"><label>작업이 나온 곳<select value={form.source} disabled={disabled} onChange={event => setForm({ ...form, source: event.target.value as IssueDetails['source'], meetingDate: form.meetingDate ?? new Date().toLocaleDateString('en-CA') })}>{Object.entries(sources).filter(([value]) => value !== 'GITHUB' || form.source === 'GITHUB').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{meeting && <label>회의 날짜<input type="date" required value={form.meetingDate ?? ''} disabled={disabled} onChange={event => setForm({ ...form, meetingDate: event.target.value })} /></label>}</div>
    {meeting && <label>회의에서 정한 내용<textarea rows={2} maxLength={10000} disabled={disabled} value={form.meetingContext} onChange={event => setForm({ ...form, meetingContext: event.target.value })} placeholder="논의 배경과 결정 내용을 팀에 남겨주세요." /></label>}
    <div className="issue-fields"><label>작업 상태<select value={form.status} disabled={disabled} onChange={event => { const value = event.target.value as IssueDetails['status']; setForm({ ...form, status: value }); if (issue?.publishStatus === 'PUBLISHED') setGithubState(value === 'DONE' ? 'CLOSED' : 'OPEN') }}>{Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>우선순위<select value={form.priority} disabled={disabled} onChange={event => setForm({ ...form, priority: event.target.value as IssueDetails['priority'] })}>{Object.entries(priorities).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <label>담당자<select value={form.assignee ?? ''} disabled={disabled || assigneesLoading} onChange={event => setForm({ ...form, assignee: event.target.value || null })}><option value="">지정하지 않음</option>{form.assignee && !assignees.some(person => person.login === form.assignee) && <option value={form.assignee}>{form.assignee}</option>}{assignees.map(person => <option key={person.login} value={person.login}>{person.login}</option>)}</select></label>
    {assigneesMore && <button className="button" type="button" disabled={assigneesLoading} onClick={() => setAssigneesPage(value => value + 1)}>담당자 더 보기</button>}
    <p className="help-text">이 저장소에 이슈를 배정할 수 있는 프로젝트 멤버만 표시해요. 회의 내용은 zello에 보관하고, 발행할 때 우선순위 라벨도 자동으로 준비해요.</p>
    {issue?.publishStatus === 'PUBLISHED' && <label>GitHub 이슈 상태<select value={githubState ?? 'OPEN'} disabled={disabled} onChange={event => { const state = event.target.value as 'OPEN' | 'CLOSED'; setGithubState(state); setForm({ ...form, status: state === 'CLOSED' ? 'DONE' : form.status === 'DONE' ? 'TODO' : form.status }) }}><option value="OPEN">열림</option><option value="CLOSED">닫힘 · 완료</option></select></label>}
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="connection-notice" role="status">{notice}</p>}
    {stale && issue && <button className="button" type="button" disabled={busy} onClick={() => { void getIssue(projectId, issue.id).then(onChanged).then(() => onClose()).catch(report) }}>최신 내용을 다시 열기</button>}
    {!issue && canWrite && <label className="issue-publish-choice"><input type="checkbox" checked={publishAfterSave} disabled={busy} onChange={event => setPublishAfterSave(event.target.checked)} /><span><strong>저장하고 GitHub에도 이슈 만들기</strong><small>선택한 저장소에 실제 이슈가 생성돼요. 체크를 끄면 zello에만 저장합니다.</small></span></label>}
    <div className="form-actions"><span className="help-text">{issue?.publishStatus === 'PUBLISHED' ? '제목·설명·완료 조건·담당자는 GitHub에도 반영돼요.' : !issue && publishAfterSave ? 'zello에 먼저 저장한 뒤 선택한 저장소에 실제 이슈를 만듭니다.' : 'zello에만 저장하면 GitHub에는 아직 만들어지지 않아요.'}</span><button type="button" className="button" disabled={busy} onClick={onClose}>닫기</button>{canWrite && !issue?.archived && !unresolved && <button className="button button-dark" type="submit" disabled={!valid || busy || stale}>{busy ? '처리 중…' : !issue && publishAfterSave ? '저장하고 GitHub에 만들기' : issue ? '작업 저장' : 'zello에만 저장'}</button>}</div>
    {issue && canWrite && !issue.archived && issue.publishStatus !== 'PUBLISHED' && <div className="issue-publication"><p>{dirty ? '수정한 내용을 먼저 저장한 다음 발행해 주세요.' : issue.lastPublishError || '저장한 제목·설명·완료 조건·담당자로 GitHub에 이슈를 발행해요.'}</p><button className="button" type="button" disabled={busy || !!dirty} onClick={() => void publish()}><Github size={14} />{unresolved ? '이전 발행 결과 확인' : '저장한 작업 GitHub에 발행'}</button></div>}
    {issue && canWrite && <div className="issue-archive">{confirmArchive && !issue.archived ? <><p>이 작업을 보관할까요? GitHub 이슈는 유지되며 보관 목록에서 복원할 수 있어요.</p><button className="button" type="button" disabled={busy} onClick={() => void archive()}>보관하기</button><button className="button" type="button" onClick={() => setConfirmArchive(false)}>취소</button></> : <button className="subtle-link" type="button" disabled={busy} onClick={() => issue.archived ? void archive() : setConfirmArchive(true)}><Archive size={13} />{issue.archived ? '작업 복원' : '작업 보관'}</button>}</div>}
  </form></IssueDialog>
}
