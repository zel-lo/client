import { useWorkspaceData } from '../hooks/use-workspace-data'
import { ChevronLeft, ChevronRight } from 'lucide-react'
export { useWorkspaceData } from '../hooks/use-workspace-data'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { readNotification, readAllNotifications, changed } from '../lib/workspace-api'
import type { Activity, Notification, Page } from '../lib/workspace-api'
import { listIssues, syncIssues } from '../lib/project-api'
import type { LiveIssue } from '../lib/project-api'
import { LoadingState } from './loading-state'

function Failure({ error, retry }: { error: string; retry: () => void }) { return error ? <div role="alert" className="connection-error">{error}<button className="button" onClick={retry}>다시 시도</button></div> : null }
function Pagination({ page, hasNext, setPage }: { page: number; hasNext?: boolean; setPage: (n: number) => void }) { return <div className="connection-pagination"><button className="button" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={14} />이전</button><span>{page} 페이지</span><button className="button" disabled={!hasNext} onClick={() => setPage(page + 1)}>다음<ChevronRight size={14} /></button></div> }
export function activityPath(a: Activity) { return a.issueId ? `/issues?issue=${a.issueId}` : a.pullRequestId ? `/pull-requests?pr=${a.pullRequestId}` : a.patchNoteId ? `/changes?note=${a.patchNoteId}` : '/settings?tab=members' }
export function ActivityFeed({ project }: { project: string }) {
  const [page, setPage] = useState(1)
  const result = useWorkspaceData<Page<Activity>>(project, `activities?page=${page}`)
  return <section><div className="section-heading"><h2>프로젝트 활동 기록</h2><button className="button" onClick={result.refresh}>새로고침</button></div><p className="help-text">zello에 기록된 작업 완료, 담당자 배정, 멤버 관리와 팀 업데이트 이력입니다.</p><Failure error={result.error} retry={result.refresh} />{result.loading && !result.data ? <LoadingState /> : result.data && <>{!result.data.items.length && <p className="empty-state">아직 기록된 활동이 없어요.</p>}{result.data.items.map(a => <article className="workspace-record" key={a.id}><Link to={activityPath(a)}><strong>{a.title}</strong></Link><p>{a.summary}</p><small>{a.actor ?? '시스템'} · {new Date(a.occurredAt + 'Z').toLocaleString('ko-KR')}</small></article>)}<Pagination page={page} hasNext={result.data.hasNext} setPage={setPage} /></>}</section>
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
  useEffect(() => { const c = new AbortController(); setItems([]); setError(''); setLoading(!!query.trim()); const timer = setTimeout(() => { if (!query.trim()) return; listIssues(project, { query: query.trim(), size: 30 }, c.signal).then(r => { if (!c.signal.aborted) setItems(r.items) }).catch(e => { if (!c.signal.aborted) setError(e.message) }).finally(() => { if (!c.signal.aborted) setLoading(false) }) }, 250); return () => { c.abort(); clearTimeout(timer) } }, [project, query])
  return <><label className="settings-form">프로젝트 검색어<input autoFocus value={query} placeholder="작업 제목이나 이슈 번호 검색" onChange={e => setQuery(e.target.value)} /></label>{error && <p role="alert">{error}</p>}{loading ? <LoadingState /> : items.map(i => <Link className="workspace-record" key={i.id} to={`/issues?issue=${i.id}`} onClick={onClose}>{i.key} · {i.title}</Link>)}{query.trim() && !loading && !error && !items.length && <p>일치하는 작업이 없어요.</p>}<div className="form-actions"><Link className="button" to="/issues?new=1" onClick={onClose}>새 작업 등록</Link><Link className="button" to="/settings?tab=repositories" onClick={onClose}>저장소 연결</Link></div></>
}
export function SyncPanel({ project }: { project: string }) {
  const runs = useWorkspaceData<Page<{ id: string; repository: string; scope: string; status: string; processed: number; finishedAt: string | null; error: string | null }>>(project, 'sync-runs')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('')
  async function sync() { setBusy(true); setError(''); try { const r = await syncIssues(project); setMessage(`이슈 ${r.collected}개를 가져왔어요.${r.skippedRepositories ? ` 접근할 수 없는 저장소 ${r.skippedRepositories}개를 건너뛰었어요.` : ''}${r.hasMore ? ' 남은 이슈는 다시 가져오기를 눌러 이어서 수집하세요.' : ''}`); changed(); window.dispatchEvent(new Event('zello:issues-updated')) } catch(e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <section><h2>데이터 동기화</h2><p>연결된 저장소의 GitHub 이슈를 가져옵니다.</p><button className="button" disabled={busy} onClick={() => void sync()}>{busy ? '가져오는 중…' : 'GitHub 이슈 가져오기'}</button>{message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}<h3>최근 수집 기록</h3><Failure error={runs.error} retry={runs.refresh} />{runs.data?.items.map(r => <article className="workspace-record" key={r.id}><strong>{r.repository}</strong><p>{r.scope} · {r.status} · {r.processed}개 처리</p>{r.finishedAt && <small>{new Date(r.finishedAt + 'Z').toLocaleString('ko-KR')}</small>}{r.error && <p>{r.error}</p>}</article>)}{runs.data && !runs.data.items.length && <p>아직 수집 기록이 없어요.</p>}<p className="help-text">자동 웹훅 동기화는 아직 지원하지 않습니다.</p></section>
}
