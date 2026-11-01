import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Archive, ArrowUpRight, CircleDot, Github, Plus, RefreshCw, X } from 'lucide-react'
import { archiveIssue, createIssue, getIssue, listAssignees, listConnectedRepositories, listIssues, publishIssue, restoreIssue, syncIssues, updateIssue, ProjectApiError } from '../lib/project-api'
import type { ConnectedRepository, IssueDetails, IssuePage, LiveIssue, Project } from '../lib/project-api'
import { TeamBoard, WeekNavigation, WorkViewToggle } from './team-board'
import type { BoardActions, BoardItem, BoardMove } from './team-board'
import type { IssueStatus } from '../data/work-items'
import { startOfWeek, validWeek } from '../lib/work-weeks'
import { useWorkWeek } from '../hooks/use-work-week'
import { LoadingState } from './loading-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table'

const states: Record<IssueDetails['status'], string> = { BACKLOG: '백로그', TODO: '할 일', IN_PROGRESS: '진행 중', IN_REVIEW: '검토 중', DONE: '완료' }
const sources: Record<IssueDetails['source'], string> = { REQUEST: '수시 요청', DAILY: '데일리 스크럼', WEEKLY: '주간 회의', GITHUB: 'GitHub에서 가져옴' }
const priorities = { HIGH: '높음', MEDIUM: '보통', LOW: '낮음' }
const publication = { LOCAL: 'zello에 저장됨', PENDING: 'GitHub 발행 중', PUBLISHED: 'GitHub에 발행됨', FAILED: 'GitHub 발행 실패', UNKNOWN: 'GitHub 발행 확인 필요' }
const reauthCodes = ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE']
const blank = (): IssueDetails => ({ title: '', description: '', acceptanceCriteria: '', status: 'TODO', priority: 'MEDIUM', source: 'REQUEST', meetingDate: null, meetingContext: '', assignee: null })

function detailsFor(issue: LiveIssue): IssueDetails {
  return { title: issue.title, description: issue.description ?? '', status: issue.status, priority: issue.priority, source: issue.source,
    meetingDate: issue.meetingDate, meetingContext: issue.meetingContext ?? '', acceptanceCriteria: issue.acceptanceCriteria ?? '', assignee: issue.assignee, plannedWeekStart: issue.plannedWeekStart }
}

function IssueDialog({ children, busy, onClose, drawer = false }: { children: ReactNode; busy: boolean; onClose: () => void; drawer?: boolean }) {
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
  return <div className={`dialog-backdrop ${drawer ? 'drawer-backdrop' : ''}`} onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose() }}><div className={drawer ? 'drawer issue-detail-drawer' : 'dialog dialog-wide'} role="dialog" aria-modal="true" aria-label="작업 상세" ref={panel} tabIndex={-1}><div className="dialog-header"><span className="eyebrow">회의에서 정한 일부터 실제 개발까지</span><button type="button" className="icon-button" aria-label="작업 창 닫기" disabled={busy} onClick={onClose}><X size={20} /></button></div>{children}</div></div>
}

export function LiveIssues({ project, projectLoading = false, mineOnly = false, onCountChange }: { project: Project | null; projectLoading?: boolean; mineOnly?: boolean; onCountChange?: (total: number) => void }) {
  const [params, setParams] = useSearchParams()
  const currentWeek = useWorkWeek()
  const week = params.has('week') ? validWeek(params.get('week')) : currentWeek
  const [result, setResult] = useState<IssuePage | null>(null)
  const [repositories, setRepositories] = useState<ConnectedRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reauth, setReauth] = useState(false)
  const [revision, setRevision] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [editing, setEditing] = useState<LiveIssue | 'new' | null>(null)
  const [opening, setOpening] = useState(false)
  const [pendingMove, setPendingMove] = useState<BoardMove | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [archived, setArchived] = useState(false)
  const [mine, setMine] = useState(mineOnly)
  const [page, setPage] = useState(1)
  const [repoFilter, setRepoFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [knownAssignees, setKnownAssignees] = useState<string[]>([])
  const request = useRef<AbortController | null>(null)
  const detailRequest = useRef<AbortController | null>(null)
  const mutating = useRef(false)
  const mounted = useRef(true)
  const scope = useRef(project?.id); scope.current = project?.id
  const view = mineOnly || archived || params.get('view') === 'list' ? 'list' : 'board'
  const canWrite = !!project && ['OWNER', 'ADMIN', 'MEMBER'].includes(project.role)
  const focusUnassigned = params.get('focus') === 'unassigned'
  const loadKey = `${repoFilter}:${assigneeFilter}:${focusUnassigned}:${project?.id}:${query}:${status}:${archived}:${mine}:${mineOnly}:${week}:${view}:${revision}`
  const currentKey = useRef(loadKey); currentKey.current = loadKey
  const busy = !!busyId || opening
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; detailRequest.current?.abort() } }, [])
  function report(cause: unknown) {
    setError(cause instanceof Error ? cause.message : '작업을 처리하지 못했어요.')
    setReauth(cause instanceof ProjectApiError && reauthCodes.includes(cause.code))
  }
  function setParam(key: string, value: string) {
    setPage(1)
    setParams(current => { const next = new URLSearchParams(current); if (key === 'week' && value === currentWeek) next.delete(key); else next.set(key, value); return next })
  }
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(queryInput); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [queryInput])
  useEffect(() => {
    const updated = () => { setPage(1); setRevision(value => value + 1) }
    const failed = (event: Event) => { const detail = (event as CustomEvent<{ projectId: string; message: string }>).detail; if (detail.projectId === scope.current) setError(detail.message) }
    window.addEventListener('zello:issues-updated', updated)
    window.addEventListener('zello:issues-sync-error', failed)
    return () => { window.removeEventListener('zello:issues-updated', updated); window.removeEventListener('zello:issues-sync-error', failed) }
  }, [])
  useEffect(() => {
    if (!project) { setLoading(false); return }
    const controller = new AbortController(); request.current = controller
    const key = loadKey
    setLoading(true); setError(''); setReauth(false)
    void Promise.all([
      listIssues(project.id, { query, status, page, size: view === 'board' ? 100 : 30, archived, mine, activeOnly: mineOnly, repositoryId: repoFilter === 'all' ? undefined : repoFilter, assignee: focusUnassigned || assigneeFilter === 'unassigned' ? 'unassigned' : assigneeFilter === 'all' ? undefined : assigneeFilter, ...(!mineOnly && !archived ? { week } : {}) }, controller.signal),
      listConnectedRepositories(project.id, controller.signal),
    ]).then(([issues, repos]) => {
      if (controller.signal.aborted || currentKey.current !== key) return
      setResult(previous => view === 'board' && page > 1 && previous ? { ...issues, items: [...new Map([...previous.items, ...issues.items].map(item => [item.id, item])).values()] } : issues)
      setRepositories(repos)
      setKnownAssignees(current => [...new Set([...current, ...issues.items.map(item => item.assignee).filter((login): login is string => !!login)])])
    }).catch(cause => {
      if (!controller.signal.aborted && currentKey.current === key) {
        // Permission/authentication failures must not leave a protected cached board visible.
        if (cause instanceof ProjectApiError && [...reauthCodes, 'ACCESS_DENIED', 'PROJECT_NOT_FOUND', 'FORBIDDEN', 'REPOSITORY_NOT_FOUND'].includes(cause.code)) setResult(null)
        report(cause)
      }
    }).finally(() => { if (!controller.signal.aborted && currentKey.current === key) setLoading(false) })
    return () => controller.abort()
  }, [project?.id, query, status, page, archived, mine, mineOnly, revision, week, view, loadKey])
  useEffect(() => { if (result && !query && !status && !archived && mine === mineOnly && repoFilter === 'all' && assigneeFilter === 'all' && !focusUnassigned) onCountChange?.(result.total) }, [result, query, status, archived, mine, mineOnly, repoFilter, assigneeFilter, focusUnassigned, onCountChange])
  useEffect(() => {
    if (params.get('new') === '1' && project && !loading && canWrite) {
      setEditing('new'); setParams(current => { const next = new URLSearchParams(current); next.delete('new'); return next }, { replace: true })
    }
  }, [params, project, loading, canWrite, setParams])
  const loadPeople = useCallback((repositoryId: string, page: number, signal: AbortSignal) => listAssignees(project!.id, repositoryId, page, signal), [project?.id])
  async function open(issue: LiveIssue) {
    if (!project) return
    detailRequest.current?.abort()
    const controller = new AbortController(); detailRequest.current = controller
    setOpening(true); setError('')
    try { const current = await getIssue(project.id, issue.id, controller.signal); if (!controller.signal.aborted && mounted.current) setEditing(current) }
    catch (cause) { if (!controller.signal.aborted && mounted.current) report(cause) }
    finally { if (!controller.signal.aborted && mounted.current) setOpening(false) }
  }
  async function change(id: string, patch: { status?: IssueStatus; assignee?: string | null }, placement?: { beforeId: string | null }) {
    if (!project || mutating.current || !canWrite || loading) return
    const snapshot = result
    const displayed = snapshot?.items.find(item => item.id === id)
    if (!displayed) return
    const key = loadKey
    mutating.current = true; setBusyId(id); setError(''); setNotice('')
    setResult(current => {
      if (!current) return current
      const updated = { ...displayed, ...(patch.status ? { status: patch.status.toUpperCase() as IssueDetails['status'] } : {}), ...('assignee' in patch ? { assignee: patch.assignee ?? null } : {}) }
      if (!placement) return { ...current, items: current.items.map(item => item.id === id ? updated : item) }
      const rows = current.items.filter(item => item.id !== id)
      const target = placement?.beforeId ? rows.findIndex(item => item.id === placement.beforeId) : -1
      rows.splice(target < 0 ? rows.length : target, 0, updated)
      return { ...current, items: rows }
    })
    try {
      const latest = await getIssue(project.id, id)
      if (latest.status !== displayed.status || latest.archived) throw new ProjectApiError('다른 변경이 있어요. 최신 작업을 확인한 뒤 다시 시도해 주세요.', 'ISSUE_CHANGED')
      const details = { ...detailsFor(latest), ...(patch.status ? { status: patch.status.toUpperCase() as IssueDetails['status'] } : {}), ...('assignee' in patch ? { assignee: patch.assignee ?? null } : {}) }
      if (displayed.status === 'BACKLOG' && patch.status && patch.status !== 'backlog') details.plannedWeekStart = week
      const githubState = patch.status ? patch.status === 'done' ? 'CLOSED' : 'OPEN' : latest.githubState
      const saved = await updateIssue(project.id, latest, details, githubState, placement)
      if (!mounted.current || currentKey.current !== key) return
      setResult(current => current ? { ...current, items: current.items.map(item => item.id === id ? saved : item) } : current)
      setNotice(patch.status ? `${saved.key} 작업 위치를 저장했어요.${saved.publishStatus === 'PUBLISHED' && patch.status === 'done' ? ' GitHub 이슈도 닫았어요.' : ''}` : `${saved.key} 담당자를 저장했어요.`)
      setPage(1); setRevision(value => value + 1)
    } catch (cause) {
      if (mounted.current && currentKey.current === key) { setResult(snapshot); report(cause) }
      if (!patch.status) throw cause
    } finally { mutating.current = false; if (mounted.current) setBusyId(null) }
  }
  async function sync() {
    if (!project || syncing || busy) return
    const id = project.id
    setSyncing(true); setError(''); setNotice('')
    try {
      const result = await syncIssues(id)
      if (!mounted.current) return
      setNotice(`${result.collected}개 이슈를 확인했어요.${result.skippedRepositories ? ` 접근할 수 없는 저장소 ${result.skippedRepositories}개는 건너뛰었어요.` : ''}${result.hasMore ? ' 최근 수정된 1,000개까지만 가져왔어요.' : ''}`)
      setPage(1); setRevision(value => value + 1)
    } catch (cause) { if (mounted.current) report(cause) } finally { if (mounted.current) setSyncing(false) }
  }
  if (projectLoading && !project) return <LoadingState layout={mineOnly ? 'list' : 'board'} label="프로젝트와 작업을 불러오는 중" />
  if (!project) return <div className="empty-state"><Github size={28} /><h2>팀의 저장소로 시작해요</h2><p>저장소를 연결하면 회의에서 정한 작업을 저장하고 GitHub에 발행할 수 있어요.</p><Link className="button button-dark" to="/onboarding">프로젝트와 저장소 연결</Link></div>
  const filtered = (result?.items ?? []).filter(item => (repoFilter === 'all' || item.repositoryId === repoFilter) && (assigneeFilter === 'all' || (assigneeFilter === 'unassigned' ? !item.assignee : item.assignee === assigneeFilter)) && (params.get('focus') !== 'unassigned' || !item.assignee))
  const boardItems: BoardItem[] = filtered.map(item => ({ id: item.id, key: item.key, title: item.title, status: item.status.toLowerCase() as IssueStatus, priority: item.priority.toLowerCase() as BoardItem['priority'], repositoryId: item.repositoryId, repositoryName: item.repositoryName, number: item.number, assignee: item.assignee, sourceLabel: sources[item.source], meetingDate: item.meetingDate, plannedWeekStart: item.plannedWeekStart ?? week, completedAt: item.completedAt,
    locked: item.publishStatus === 'PENDING' || item.publishStatus === 'UNKNOWN',
    attention: item.publishStatus === 'FAILED' ? { label: 'GitHub 발행을 다시 확인해 주세요', tone: 'danger' } : item.publishStatus === 'UNKNOWN' || item.publishStatus === 'PENDING' ? { label: 'GitHub 발행 결과 확인 중', tone: 'warning' } : !item.assignee && item.status !== 'DONE' ? { label: '함께할 담당자를 지정해 주세요', tone: 'warning' } : undefined,
  }))
  const actions: BoardActions = { onOpen: id => { const item = result?.items.find(item => item.id === id); if (item) void open(item) }, onMove: move => { const item = result?.items.find(item => item.id === move.id); if (item?.publishStatus === 'PUBLISHED' && (move.status === 'done' || item.status === 'DONE') && item.status !== move.status.toUpperCase()) { setPendingMove(move); return }; return change(move.id, { status: move.status }, { beforeId: move.beforeId }) }, onAssign: (id, login) => change(id, { assignee: login }), loadAssignees: loadPeople }
  return <section className="live-issues" aria-label={mineOnly ? '실제 맡은 작업' : '실제 팀 작업'}>
    <div className="section-heading"><h2>{mineOnly ? '내가 맡은 작업' : '팀의 작업'} <span className="count-text">{result?.total ?? '—'}</span></h2><div className="issue-actions"><button className="button" disabled={syncing || busy || loading} onClick={() => void sync()}><RefreshCw size={14} className={syncing ? 'board-saving' : ''} />{syncing ? 'GitHub 확인 중…' : 'GitHub 이슈 가져오기'}</button>{canWrite && <button className="button button-dark" disabled={busy} onClick={() => { setError(''); setEditing('new') }}><Plus size={14} />새 작업 등록</button>}</div></div>
    {error && <div className="connection-error" role="alert">{error}{reauth ? <Link to="/login?reauth=github">GitHub 다시 로그인</Link> : <button className="button" disabled={loading || busy} onClick={() => { setPage(1); setRevision(value => value + 1) }}>다시 불러오기</button>}</div>}
    {notice && <p className="connection-notice" role="status">{notice}</p>}
    {!mineOnly && !archived && <WeekNavigation week={week} onChange={value => setParam('week', value)} disabled={busy} />}
    <div className="board-toolbar">
      {!mineOnly && <WorkViewToggle view={view} disabled={busy} onChange={value => setParam('view', value)} />}
      <input className="board-search" type="search" aria-label="작업 검색" value={queryInput} disabled={busy} onChange={event => setQueryInput(event.target.value)} placeholder="제목 또는 작업 번호 검색" />
      <select aria-label="진행 상태" disabled={busy} value={status} onChange={event => { setStatus(event.target.value); setPage(1) }}><option value="">모든 상태</option>{Object.entries(states).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="담당자 필터" disabled={busy} value={assigneeFilter} onChange={event => { setAssigneeFilter(event.target.value); setPage(1); if (focusUnassigned) setParams(current => { const next = new URLSearchParams(current); next.delete('focus'); return next }) }}><option value="all">모든 담당자</option><option value="unassigned">담당자 미지정</option>{knownAssignees.map(login => <option key={login} value={login!}>{login}</option>)}</select>
      <select aria-label="저장소 필터" disabled={busy} value={repoFilter} onChange={event => { setRepoFilter(event.target.value); setPage(1) }}><option value="all">모든 저장소</option>{repositories.map(repo => <option key={repo.id} value={repo.id}>{repo.name}</option>)}</select>
      <select aria-label="작업 목록" disabled={busy} value={archived ? 'archived' : 'active'} onChange={event => { setArchived(event.target.value === 'archived'); setPage(1) }}><option value="active">진행·완료한 작업</option><option value="archived">보관한 작업</option></select>
      {!mineOnly && <label className="inline-checkbox"><input type="checkbox" checked={mine} disabled={busy} onChange={event => { setMine(event.target.checked); setPage(1) }} />내 작업만</label>}
      {(queryInput || status || repoFilter !== 'all' || assigneeFilter !== 'all' || mine !== mineOnly || params.get('focus') === 'unassigned') && <button type="button" className="subtle-link" disabled={busy} onClick={() => { setQueryInput(''); setStatus(''); setRepoFilter('all'); setAssigneeFilter('all'); setMine(mineOnly); setPage(1); setParams(current => { const next = new URLSearchParams(current); next.delete('focus'); return next }) }}>필터 초기화</button>}
      {loading && result && <span className="board-refresh-status" role="status"><RefreshCw size={12} className="board-saving" />작업을 갱신하고 있어요</span>}
    </div>
    {loading && !result ? <LoadingState layout={view} label="저장한 작업을 불러오는 중" /> : result && <>
      {view === 'board' ? <TeamBoard items={boardItems} week={week} actions={actions} canWrite={canWrite} busyId={busyId} disabled={loading || syncing} onCreate={() => setEditing('new')} /> : <div className="data-frame"><Table><TableHeader><TableRow><TableHead>작업 / 등록 경로</TableHead><TableHead>상태</TableHead><TableHead>담당자</TableHead><TableHead>우선순위</TableHead><TableHead>GitHub 발행</TableHead></TableRow></TableHeader><TableBody>{filtered.map(issue => <TableRow key={issue.id}>
        <TableCell><button className="issue-title" disabled={busy} onClick={() => void open(issue)}><CircleDot size={15} /><span>{issue.title}<small>{issue.number ? `${issue.repositoryOwner}/${issue.repositoryName}#${issue.number}` : issue.key} · {sources[issue.source]}{issue.meetingDate ? ` · ${issue.meetingDate}` : ''}</small></span></button></TableCell>
        <TableCell><span className={`issue-status-badge issue-status-${issue.status.toLowerCase()}`}>{states[issue.status]}</span>{issue.githubState === 'CLOSED' && <small className="muted"> · GitHub 닫힘</small>}</TableCell>
        <TableCell>{issue.assignee ?? '지정 필요'}</TableCell><TableCell>{priorities[issue.priority]}</TableCell><TableCell><span className="badge">{publication[issue.publishStatus]}</span></TableCell>
      </TableRow>)}</TableBody></Table></div>}
      {!filtered.length && <div className="empty-state"><CircleDot size={25} /><h3>{archived ? '보관한 작업이 없어요' : '아직 표시할 작업이 없어요'}</h3><p>{repositories.length ? '조건을 바꾸거나 이번 주에 할 작업을 등록해 보세요.' : '먼저 프로젝트에 저장소를 연결해 주세요.'}</p>{!repositories.length && <Link className="button" to="/settings?tab=repositories">저장소 연결</Link>}</div>}
      {view === 'board' ? <div className="board-pagination"><span>{result.items.length} / {result.total}개 작업 표시</span>{result.hasNext && <button className="button" disabled={loading || busy} onClick={() => setPage(value => value + 1)}>{loading ? '불러오는 중…' : '작업 더 불러오기'}</button>}</div> : <div className="connection-pagination"><button className="button" disabled={page === 1 || loading || busy} onClick={() => setPage(value => value - 1)}>이전 작업</button><span>{page} 페이지</span><button className="button" disabled={!result.hasNext || loading || busy} onClick={() => setPage(value => value + 1)}>다음 작업</button></div>}
    </>}
    <p className="help-text">{mineOnly ? '현재 맡은 미완료 작업을 모았어요.' : '미완료 작업은 원래 계획 주차를 유지하며 다음 주에도 표시돼요. 완료한 작업은 완료한 주에 남아요.'} 새 작업은 zello에 저장한 뒤 GitHub에도 만들 수 있어요.</p>
    {pendingMove && <IssueDialog busy={false} onClose={() => setPendingMove(null)}><div className="dialog-form"><h2>{pendingMove.status === 'done' ? '작업을 완료할까요?' : '작업을 다시 시작할까요?'}</h2><p>{pendingMove.status === 'done' ? '연결된 GitHub 이슈도 함께 닫아요. 서비스 배포 상태는 별도로 확인해 주세요.' : '연결된 GitHub 이슈도 다시 열어요.'}</p><div className="form-actions"><button className="button" onClick={() => setPendingMove(null)}>취소</button><button className="button button-dark" onClick={() => { const move = pendingMove; setPendingMove(null); void change(move.id, { status: move.status }, { beforeId: move.beforeId }) }}>{pendingMove.status === 'done' ? '완료하고 GitHub 이슈 닫기' : 'GitHub 이슈 다시 열고 이동'}</button></div></div></IssueDialog>}
    {opening && !editing && <IssueDialog busy={false} drawer onClose={() => { detailRequest.current?.abort(); setOpening(false) }}><div className="dialog-form"><LoadingState layout="detail" label="작업 상세를 불러오는 중" /></div></IssueDialog>}
    {editing && <IssueEditor projectId={project.id} issue={editing === 'new' ? null : editing} initialWeek={week} repositories={repositories} canWrite={canWrite} onClose={() => setEditing(null)} onChanged={item => { setEditing(item); setPage(1); setRevision(value => value + 1) }} onArchived={() => { setEditing(null); setPage(1); setRevision(value => value + 1); setNotice(archived ? '작업을 복원했어요.' : '작업을 보관했어요. GitHub 원본은 유지됩니다.') }} />}
  </section>
}

function IssueEditor({ projectId, issue, repositories, canWrite, initialWeek, onClose, onChanged, onArchived }: {
  projectId: string; issue: LiveIssue | null; initialWeek: string; repositories: ConnectedRepository[]; canWrite: boolean
  onClose: () => void; onChanged: (issue: LiveIssue) => void; onArchived: () => void
}) {
  const [form, setForm] = useState<IssueDetails>(issue ? detailsFor(issue) : { ...blank(), plannedWeekStart: initialWeek })
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
  return <IssueDialog onClose={onClose} busy={busy} drawer={!!issue}><form className="dialog-form" onSubmit={event => void submit(event)}>
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
    <label>계획 주차<input type="date" value={form.plannedWeekStart ?? initialWeek} disabled={disabled} onChange={event => { if (event.target.value) setForm({ ...form, plannedWeekStart: startOfWeek(event.target.value) }) }} /></label>
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
