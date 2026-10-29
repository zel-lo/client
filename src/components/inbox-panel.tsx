import { useState } from 'react'
import { Bell, CheckCheck, ChevronRight, GitPullRequest, MessageSquare, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { InboxItem } from '@/data/inbox'
import type { Repo } from '@/data/mock'

const icons = { review: GitPullRequest, meeting: MessageSquare, deployment: Rocket }
function InboxRow({ item, repos, onOpen }: { item: InboxItem; repos: Repo[]; onOpen: (item: InboxItem) => void }) {
  const Icon = icons[item.kind]
  return <button className={`inbox-open ${item.readAt ? 'is-read' : 'is-unread'}`} onClick={() => onOpen(item)}><span className={`inbox-event inbox-event-${item.kind}`}><Icon size={17} /></span><span className="inbox-copy"><strong>{item.title}</strong><span>{item.body}</span><small>모아 프로젝트 · {repos.find(repo => repo.id === item.repo)?.name ?? item.repo} · {item.createdAt.slice(5, 10).replace('-', '/')} {item.createdAt.slice(11, 16)}</small></span><span className="inbox-unread-dot" aria-label={item.readAt ? '읽음' : '미확인'} /><ChevronRight size={14} /></button>
}
export function InboxPanel({ items, repos, onOpen, onRead, onReadAll }: {
  items: InboxItem[]; repos: Repo[]; onOpen: (item: InboxItem) => void; onRead: (id: string, read: boolean) => void; onReadAll: () => void;
}) {
  const [tab, setTab] = useState('unread')
  const unread = items.filter(item => !item.readAt)
  const visible = [...(tab === 'unread' ? unread : items)].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return <section aria-label="개인 알림함" className="inbox-panel"><div className="content-filter"><div className="segmented-tabs"><button aria-pressed={tab === 'unread'} className={tab === 'unread' ? 'selected' : ''} onClick={() => setTab('unread')}>미확인 <span className="tab-count">{unread.length}</span></button><button aria-pressed={tab === 'all'} className={tab === 'all' ? 'selected' : ''} onClick={() => setTab('all')}>전체 <span className="tab-count">{items.length}</span></button></div><button className="button" onClick={onReadAll} disabled={!unread.length}><CheckCheck size={14} />모두 읽음</button></div>
    <div className="data-frame inbox-list">{visible.map(item => <div className="inbox-item" key={item.id}><InboxRow item={item} repos={repos} onOpen={onOpen} /><button className="inbox-read-action subtle-link" onClick={() => onRead(item.id, !item.readAt)}>{item.readAt ? '다시 미확인으로' : '읽음으로 표시'}</button></div>)}{!visible.length && <div className="empty-state"><Bell size={28} /><h3>미확인 알림이 없어요</h3><p>이미 확인한 소식은 전체 탭에서 다시 볼 수 있어요.</p></div>}</div>
    <p className="work-demo-note">이수빈 님의 샘플 알림입니다. 알림함을 여는 것만으로 읽음 처리하지 않으며, 읽음 상태는 이 브라우저에 저장됩니다. 알림을 읽어도 실제 작업은 남아 있어요.</p>
  </section>
}
export function InboxPreview({ items, repos, onOpen }: { items: InboxItem[]; repos: Repo[]; onOpen: (item: InboxItem) => void }) {
  const unread = items.filter(item => !item.readAt)
  return <div className="notification-popover inbox-preview"><div><strong>내가 확인할 소식</strong><span className="badge">미확인 {unread.length}</span></div>{unread.slice(0, 3).map(item => <InboxRow key={item.id} item={item} repos={repos} onOpen={onOpen} />)}{!unread.length && <p className="inbox-preview-empty">미확인 알림이 없어요.</p>}<Link className="inbox-preview-footer" to="/inbox">알림함 보기<ChevronRight size={13} /></Link></div>
}
