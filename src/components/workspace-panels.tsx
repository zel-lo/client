import { useWorkspaceData } from '../hooks/use-workspace-data'
import { ArrowRight, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GitPullRequest, RefreshCw, Users } from 'lucide-react'
export { useWorkspaceData } from '../hooks/use-workspace-data'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { readNotification, readAllNotifications, changed } from '../lib/workspace-api'
import type { Activity, Notification, Page } from '../lib/workspace-api'
import { listIssues, syncIssues, syncPullRequests } from '../lib/project-api'
import type { LiveIssue } from '../lib/project-api'
import { LoadingState } from './loading-state'
import { displayDate } from '../lib/display-date'

function Failure({ error, retry }: { error: string; retry: () => void }) { return error ? <div role="alert" className="connection-error">{error}<button className="button" onClick={retry}>다시 시도</button></div> : null }
function Pagination({ page, hasNext, setPage }: { page: number; hasNext?: boolean; setPage: (n: number) => void }) { return <div className="connection-pagination"><button className="button" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} />이전</button><span>{page} 페이지</span><button className="button" disabled={!hasNext} onClick={() => setPage(page + 1)}>다음<ChevronRight size={14} /></button></div> }
export function activityPath(a: Activity) { return a.issueId ? `/issues?issue=${a.issueId}` : a.pullRequestId ? `/pull-requests?pr=${a.pullRequestId}` : a.patchNoteId ? `/changes?note=${a.patchNoteId}` : '/settings?tab=members' }
export function ActivityFeed({ project }: { project: string }) {
  const [page, setPage] = useState(1)
  const result = useWorkspaceData<Page<Activity>>(project, `activities?page=${page}`)
  return <section className="live-records" aria-label="프로젝트 활동 기록">
    <div className="section-heading"><div><h2>팀이 함께 남긴 기록</h2><p className="section-subheading">작업 배정부터 완료, 팀 업데이트까지 시간순으로 확인하세요.</p></div><button className="button" disabled={result.loading} onClick={result.refresh}><RefreshCw size={14} />새로고침</button></div>
    <Failure error={result.error} retry={result.refresh} />
    {result.loading && !result.data ? <LoadingState /> : result.data && <>
      {!result.data.items.length ? <div className="empty-state"><Clock3 size={28} /><h3>팀의 첫 기록을 기다리고 있어요</h3><p>작업을 배정하고 진행하면 팀이 한 일이 이곳에 모여요.</p><Link className="button" to="/issues">팀 작업 보기<ArrowRight size={14} /></Link></div> : <div className="live-record-list">{result.data.items.map(item => <Link className="live-record-item" key={item.id} to={activityPath(item)}><span className="live-record-icon">{item.type.startsWith('PROJECT_') ? <Users size={18} /> : item.type.includes('COMPLETED') || item.type.includes('MERGED') ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}</span><span className="live-record-copy"><strong>{item.title}</strong>{item.summary && !/^PROJECT_(INVITATION|MEMBER)_/.test(item.type) && <p>{item.summary}</p>}<small>{item.actor ?? '시스템'} · {displayDate(item.occurredAt)}</small></span><ArrowUpRight size={15} /></Link>)}</div>}
      {(page > 1 || result.data.hasNext) && <Pagination page={page} hasNext={result.data.hasNext} setPage={setPage} />}
    </>}
  </section>
}
export { WeeklyOverview as Overview } from './weekly-overview'
export function Notifications({ project }: { project: string }) {
  const [page, setPage] = useState(1), [unread, setUnread] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const result = useWorkspaceData<Page<Notification>>(project, `notifications?page=${page}&unread=${unread}`)
  const navigate = useNavigate()
  async function mark(id?: string, read = true, path?: string) { setBusy(true); setError(''); try { if (id) await readNotification(project, id, read); else await readAllNotifications(project); changed(); if (path) navigate(path) } catch(e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <section><div className="content-filter"><div className="segmented-tabs">{[true,false].map(v => <button key={String(v)} aria-pressed={unread === v} className={unread === v ? 'selected' : ''} onClick={() => { setUnread(v); setPage(1) }}>{v ? '미확인' : '전체'}</button>)}</div><button className="button" disabled={busy} onClick={() => void mark()}>모두 읽음</button></div><Failure error={error || result.error} retry={result.refresh} />{result.loading && !result.data ? <LoadingState /> : result.data && <>{!result.data.items.length && <p className="empty-state">{unread ? '미확인 알림이 없어요.' : '아직 받은 알림이 없어요.'}</p>}{result.data.items.map(n => <article className="workspace-record" key={n.id}><button className="table-title-button" disabled={busy} onClick={() => void mark(n.id, true, activityPath(n.activity))}>{n.title}</button><p>{n.body}</p><small>{new Date(n.activity.occurredAt + 'Z').toLocaleString('ko-KR')}</small><button className="button" disabled={busy} onClick={() => void mark(n.id, !n.readAt)}>{n.readAt ? '읽지 않음으로 표시' : '읽음으로 표시'}</button></article>)}<Pagination page={page} hasNext={result.data.hasNext} setPage={setPage} /></>}</section>
}
export { Notes } from './patch-notes'

export function ProjectSearch({ project, onClose }: { project: string; onClose: () => void }) {
  const [query, setQuery] = useState(''), [items, setItems] = useState<LiveIssue[]>([]), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  useEffect(() => { const c = new AbortController(); setItems([]); setError(''); setLoading(!!query.trim()); const timer = setTimeout(() => { if (!query.trim()) return; listIssues(project, { query: query.trim(), size: 30 }, c.signal).then(r => { if (!c.signal.aborted) setItems(r.items) }).catch(e => { if (!c.signal.aborted) setError(e.message) }).finally(() => { if (!c.signal.aborted) setLoading(false) }) }, 250); return () => { c.abort(); clearTimeout(timer) } }, [project, query])
  return <div className="project-search"><label className="project-search-label">프로젝트 검색어<input autoFocus value={query} placeholder="작업 제목이나 이슈 번호 검색" onChange={e => setQuery(e.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !loading && items[0]) { event.preventDefault(); navigate(`/issues?issue=${encodeURIComponent(items[0].id)}`); onClose() } }} /></label>
    {!query.trim() && <><p className="help-text">현재 프로젝트의 작업을 찾거나 자주 쓰는 화면으로 바로 이동하세요.</p><nav className="search-quick-links" aria-label="빠른 이동">{[['/overview', '전체 현황'], ['/my-work', '내 작업'], ['/issues', '팀 작업'], ['/pull-requests', '코드 검토'], ['/changes', '변경 소식']].map(([to, label]) => <Link key={to} to={to} onClick={onClose}>{label}<ArrowRight size={14} /></Link>)}</nav></>}
    {error && <p className="connection-error" role="alert">{error}</p>}{loading ? <LoadingState rows={3} label="프로젝트 작업을 검색하는 중" /> : items.map(item => <Link className="live-record-item" key={item.id} to={`/issues?issue=${encodeURIComponent(item.id)}`} onClick={onClose}><span className="live-record-copy"><strong>{item.title}</strong><small>{item.key} · {item.repositoryName}</small></span><ArrowRight size={14} /></Link>)}
    {query.trim() && !loading && !error && !items.length && <div className="empty-state"><h3>일치하는 작업이 없어요</h3><p>작업 제목의 일부나 이슈 번호로 다시 찾아보세요.</p></div>}<div className="form-actions"><Link className="button" to="/issues?new=1" onClick={onClose}>새 작업 등록</Link><Link className="button" to="/settings?tab=repositories" onClick={onClose}>저장소 연결</Link></div>
  </div>
}
export function SyncPanel({ project }: { project: string }) {
  const runs = useWorkspaceData<Page<{ id: string; repository: string; scope: string; status: string; processed: number; finishedAt: string | null; error: string | null }>>(project, 'sync-runs')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  const mounted = useRef(true), pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function sync() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setMessage('')
    const messages: string[] = [], failures: string[] = []
    for (const source of [{ label: '이슈', run: () => syncIssues(project) }, { label: 'PR', run: () => syncPullRequests(project) }]) {
      try {
        const result = await source.run()
        messages.push(`${source.label} ${result.collected}개 확인${result.skippedRepositories ? ` · 접근하지 못한 저장소 ${result.skippedRepositories}개` : ''}${'hasMore' in result && result.hasMore ? ' · 남은 이슈는 다시 가져오기로 이어서 확인하세요' : ''}`)
      } catch (cause) { failures.push(`${source.label}: ${cause instanceof Error ? cause.message : '가져오지 못했어요.'}`) }
    }
    changed(); window.dispatchEvent(new Event('zello:issues-updated')); window.dispatchEvent(new Event('zello:pull-requests-updated'))
    pending.current = false
    if (mounted.current) { setMessage(messages.join(' / ')); setError(failures.join(' / ')); setBusy(false) }
  }
  const statuses: Record<string, string> = { SUCCESS: '완료', SUCCEEDED: '완료', COMPLETED: '완료', FAILED: '실패', PENDING: '대기 중', RUNNING: '확인 중', PARTIAL: '일부 확인' }
  return <section className="live-records sync-panel" aria-label="데이터 동기화">
    <div className="sync-intro"><span className="sync-intro-icon"><RefreshCw size={24} /></span><div><h2>팀의 GitHub 소식을 최신으로</h2><p>연결된 저장소의 이슈와 PR, 검토 상태를 가져와요.<br />GitHub에서 바뀐 내용이 보이지 않을 때 여기서 확인하세요.</p></div><button className="button button-dark" disabled={busy} onClick={() => void sync()}><RefreshCw size={15} className={busy ? 'is-syncing' : ''} />{busy ? 'GitHub에서 가져오는 중…' : 'GitHub 최신 상태 가져오기'}</button></div>
    <p className="sync-source-note"><Clock3 size={14} />현재는 필요할 때 직접 가져오는 방식이에요. 화면의 새로고침은 저장된 기록을 다시 조회해요.</p>
    {message && <p className="connection-notice" role="status">{message}</p>}{error && <p className="connection-error" role="alert">{error}</p>}
    <div className="section-heading"><h2>최근 이슈 수집 기록</h2><button className="button" disabled={runs.loading || busy} onClick={runs.refresh}>기록 새로고침</button></div><Failure error={runs.error} retry={runs.refresh} />
    {runs.loading && !runs.data ? <LoadingState rows={3} label="수집 기록을 확인하는 중" /> : runs.data && <>{runs.data.items.length ? <div className="live-record-list">{runs.data.items.map(run => <article className="live-record-item" key={run.id}><span className="live-record-icon"><GitPullRequest size={18} /></span><div className="live-record-copy"><strong>{run.repository}</strong><p>{statuses[run.status] ?? '상태 확인 필요'} · {run.processed}개 처리</p><small>{displayDate(run.finishedAt)}</small>{run.error && <p className="sync-run-error">{run.error}</p>}</div></article>)}</div> : <div className="empty-state"><RefreshCw size={26} /><h3>아직 가져온 기록이 없어요</h3><p>저장소를 연결한 뒤 위의 버튼으로 팀의 변경 사항을 가져오세요.</p><Link className="button" to="/settings?tab=repositories">연결된 저장소 확인<ArrowRight size={14} /></Link></div>}</>}
  </section>
}
