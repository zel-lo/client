import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useWorkspaceData } from '../hooks/use-workspace-data'
import { changed, readAllNotifications, readNotification } from '../lib/workspace-api'
import type { Notification, Page } from '../lib/workspace-api'
import { displayDate } from '../lib/display-date'
import { activityPath } from './workspace-panels'
import { LoadingState } from './loading-state'

export function LiveInbox({ project, preview = false, onNavigate }: { project: string; preview?: boolean; onNavigate?: () => void }) {
  const [page, setPage] = useState(1)
  const [unread, setUnread] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const result = useWorkspaceData<Page<Notification>>(project, `notifications?page=${page}&unread=${unread}`)
  const navigate = useNavigate()
  const mounted = useRef(true)
  const pending = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function mark(item?: Notification, open = false) {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      if (item) await readNotification(project, item.id, open || !item.readAt)
      else await readAllNotifications(project)
      changed()
      if (mounted.current) {
        if (open && item) { navigate(activityPath(item.activity)); onNavigate?.() }
        else if (unread && page > 1) setPage(1)
      }
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '알림을 처리하지 못했어요.') }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  const items = result.data?.items ?? []
  const visible = preview ? items.slice(0, 3) : items
  const content = <>
    {!preview && <div className="content-filter"><div className="segmented-tabs">{[true, false].map(value => <button type="button" key={String(value)} disabled={busy} aria-pressed={unread === value} className={unread === value ? 'selected' : ''} onClick={() => { setUnread(value); setPage(1) }}>{value ? '미확인' : '전체'}</button>)}</div><button type="button" className="button" disabled={busy || result.loading || !items.some(item => !item.readAt)} onClick={() => void mark()}><CheckCheck size={14} />모두 읽음</button></div>}
    {(error || result.error) && <div className="connection-error" role="alert">{error || result.error}<button className="button" type="button" disabled={busy || result.loading} onClick={result.refresh}><RefreshCw size={14} />다시 불러오기</button></div>}
    {!result.data && result.loading ? <LoadingState rows={3} label="내게 온 알림을 불러오는 중" /> : result.data && <div className={preview ? '' : 'data-frame inbox-list'}>
      {visible.map(item => <div className="inbox-item" key={item.id}><button type="button" className={`inbox-open ${item.readAt ? 'is-read' : 'is-unread'}`} disabled={busy} onClick={() => void mark(item, true)}><span className="inbox-event"><Bell size={17} /></span><span className="inbox-copy"><strong>{item.title}</strong>{item.body && <span>{item.body}</span>}<small>{item.activity.actor ?? '프로젝트'} · {displayDate(item.activity.occurredAt)}</small></span><span className="inbox-unread-dot" aria-label={item.readAt ? '읽음' : '미확인'} /><ChevronRight size={14} /></button>{!preview && <button type="button" className="inbox-read-action subtle-link" disabled={busy} onClick={() => void mark(item)}>{item.readAt ? '다시 미확인으로' : '읽음으로 표시'}</button>}</div>)}
      {!items.length && <div className={preview ? 'inbox-preview-empty' : 'empty-state'}>{!preview && <Bell size={28} />}<h3>{unread ? '미확인 알림이 없어요' : '아직 받은 알림이 없어요'}</h3>{!preview && <p>{unread ? '맡은 작업과 코드 검토는 내 작업에서 이어서 확인하세요.' : '작업 배정과 검토 요청 등 나와 관련된 소식이 여기에 모여요.'}</p>}{!preview && <Link className="button" to="/my-work">내 작업 보기<ChevronRight size={14} /></Link>}</div>}
    </div>}
    {!preview && result.data && (page > 1 || result.data.hasNext) && <nav className="connection-pagination" aria-label="알림 페이지"><button className="button" type="button" disabled={page === 1 || result.loading || busy} onClick={() => setPage(value => value - 1)}><ChevronLeft size={14} />이전</button><span>{page} 페이지</span><button className="button" type="button" disabled={!result.data.hasNext || result.loading || busy} onClick={() => setPage(value => value + 1)}>다음<ChevronRight size={14} /></button></nav>}
  </>
  return preview ? <div className="notification-popover inbox-preview"><div><strong>내가 확인할 소식</strong><span className="badge">미확인</span></div>{content}<Link className="inbox-preview-footer" to="/inbox" onClick={onNavigate}>알림함 보기<ChevronRight size={13} /></Link></div> : <section aria-label="개인 알림함" className="inbox-panel">{content}</section>
}
