import { LoadingState } from './loading-state'
import './members-panel.css'
import { initial } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, CircleHelp, Copy, Link2, Plus, RefreshCw, Users, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { changeMemberRole, createInvitation, leaveProject, listInvitations, listMembers, membershipHistory, memberDate, removeMember, revokeInvitation, roleLabels, transferProject } from '../lib/members-api'
import type { CreatedInvitation, History, InvitationsPage, Member, MemberRole, MembersPage } from '../lib/members-api'
import { ProjectApiError } from '../lib/project-api'
import { projectsChanged } from '../lib/workspace'

const invitationLabels = { PENDING: '참여 대기', ACCEPTED: '참여 완료', REVOKED: '취소됨', EXPIRED: '만료됨' }
type Action = { type: 'role' | 'remove' | 'transfer'; member: Member } | { type: 'leave' }

export function MembersPanel({ projectId, onLeft }: { projectId: string; onLeft: () => void }) {
  const [data, setData] = useState<MembersPage | null>(null)
  const [invitations, setInvitations] = useState<InvitationsPage | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [invitePage, setInvitePage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [secondaryError, setSecondaryError] = useState('')
  const [notice, setNotice] = useState('')
  const [role, setRole] = useState<MemberRole>('MEMBER')
  const [hours, setHours] = useState(72)
  const [created, setCreated] = useState<CreatedInvitation | null>(null)
  const [copied, setCopied] = useState(false)
  const [action, setAction] = useState<Action | null>(null)
  const [nextRole, setNextRole] = useState<MemberRole>('MEMBER')
  const [actionError, setActionError] = useState('')
  const [stale, setStale] = useState(false)
  const modal = useRef<HTMLDivElement>(null)
  const modalBusy = useRef(busy); modalBusy.current = busy
  const refresh = () => setRevision(value => value + 1)

  useEffect(() => {
    const timer = setTimeout(() => { setQuery(queryInput); setPage(1) }, 250)
    return () => clearTimeout(timer)
  }, [queryInput])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setSecondaryError('')
    void listMembers(projectId, query, page, controller.signal).then(async result => {
      if (controller.signal.aborted) return
      setData(result)
      if (!result.canInviteAdmin) setRole(current => current === 'ADMIN' ? 'MEMBER' : current)
      setCreated(current => result.canInvite && (result.canInviteAdmin || current?.invitation.role !== 'ADMIN') ? current : null)
      if (!result.canInvite) { setInvitations(null); setHistory(null); return }
      const results = await Promise.allSettled([listInvitations(projectId, invitePage, controller.signal), membershipHistory(projectId, historyPage, controller.signal)])
      if (controller.signal.aborted) return
      if (results[0].status === 'fulfilled') setInvitations(results[0].value)
      else { setInvitations(null); setSecondaryError('초대 목록을 확인하지 못했어요. 다시 불러와 주세요.') }
      if (results[1].status === 'fulfilled') setHistory(results[1].value)
      else { setHistory(null); setSecondaryError('관리 이력을 확인하지 못했어요. 다시 불러와 주세요.') }
    }).catch(cause => {
      if (!controller.signal.aborted) { setData(null); setCreated(null); setInvitations(null); setHistory(null); setError(cause instanceof Error ? cause.message : '멤버를 불러오지 못했어요.') }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, query, page, invitePage, historyPage, revision])
  useEffect(() => {
    const focus = () => {
      if (busy || action || document.visibilityState !== 'visible') return
      refresh()
    }
    document.addEventListener('visibilitychange', focus)
    return () => document.removeEventListener('visibilitychange', focus)
  }, [busy, action])
  useEffect(() => {
    if (!action) return
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'; modal.current?.focus()
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !modalBusy.current) setAction(null)
      if (event.key !== 'Tab') return
      const elements = modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)')
      if (!elements?.length) { event.preventDefault(); return }
      const first = elements[0], last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal.current)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal.current)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus() }
  }, [action])

  function openAction(next: Action) {
    setActionError(''); setStale(false)
    if (next.type === 'role') setNextRole(next.member.role === 'VIEWER' ? 'VIEWER' : next.member.role === 'ADMIN' ? 'ADMIN' : 'MEMBER')
    setAction(next)
  }
  async function makeInvitation() {
    if (busy || !data?.canInvite) return
    setBusy(true); setError(''); setNotice(''); setCopied(false)
    try {
      const invitation = await createInvitation(projectId, role, hours, null)
      setCreated(invitation); setInvitePage(1); refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '초대 링크를 만들지 못했어요.') }
    finally { setBusy(false) }
  }
  async function copy() {
    if (!created) return
    try { await navigator.clipboard.writeText(created.inviteUrl); setCopied(true) }
    catch { setNotice('링크를 길게 누르거나 선택해 직접 복사해 주세요.') }
  }
  async function revoke(id: string) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await revokeInvitation(projectId, id)
      setCreated(current => current?.invitation.id === id ? null : current)
      setNotice('초대 링크를 취소했어요.'); refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : '초대를 취소하지 못했어요.') }
    finally { setBusy(false) }
  }
  async function confirmAction() {
    if (!action || !data || busy) return
    setBusy(true); setActionError(''); setNotice('')
    try {
      if (action.type === 'role') await changeMemberRole(projectId, action.member, nextRole)
      else if (action.type === 'remove') await removeMember(projectId, action.member)
      else if (action.type === 'transfer') { await transferProject(projectId, action.member, data.projectVersion); setCreated(null) }
      else { await leaveProject(projectId, data.currentMemberVersion); projectsChanged(); onLeft(); return }
      setAction(null); setNotice('멤버 정보를 변경했어요.'); projectsChanged(); refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : '요청을 처리하지 못했어요.')
      setStale(cause instanceof ProjectApiError && ['MEMBERSHIP_CHANGED', 'PROJECT_OWNER_REQUIRED', 'PROJECT_ADMIN_REQUIRED', 'PROJECT_NOT_FOUND'].includes(cause.code))
    } finally { setBusy(false) }
  }
  const hasMemberActions = data?.items.some(member => member.canChangeRole || member.canRemove || member.canTransferTo)
  const actionTitle = action?.type === 'role' ? '멤버 권한 변경' : action?.type === 'remove' ? '멤버 내보내기' : action?.type === 'transfer' ? '프로젝트 소유권 이전' : '프로젝트 나가기'

  return <section className="members-panel member-settings" aria-label="프로젝트 멤버 관리">
    <div className="section-heading member-list-toolbar"><h2><Users size={18} />멤버 {data && <span className="count-text">{data.total}</span>}</h2><div className="member-toolbar-actions"><label className="member-search"><span className="sr-only">멤버 검색</span><input type="search" value={queryInput} maxLength={100} onChange={event => setQueryInput(event.target.value)} placeholder="이름 또는 GitHub 아이디 검색" /></label><button className="icon-button" title="목록 새로고침" aria-label="목록 새로고침" disabled={loading || busy} onClick={refresh}><RefreshCw size={16} /></button></div></div>
    {notice && <p className="connection-notice" role="status">{notice}</p>}
    {error && <div className="connection-error" role="alert">{error}<button className="button" disabled={busy} onClick={refresh}>다시 확인</button></div>}
    {loading && !data && <LoadingState label="멤버 정보를 불러오는 중" />}
    {data && <>
      <div className={`member-list${hasMemberActions ? ' has-management' : ''}`} aria-busy={loading}><div className="member-list-columns"><span aria-hidden="true">멤버</span><span className="member-role-heading"><span aria-hidden="true">권한</span><TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild><button type="button" className="member-permission-trigger" aria-label="권한 안내"><CircleHelp size={15} /></button></TooltipTrigger><TooltipContent side="bottom" align="end" sideOffset={6} className="member-permission-tooltip"><dl><div><dt>소유자</dt><dd>프로젝트 전체 관리</dd></div><div><dt>관리자</dt><dd>멤버와 저장소 관리</dd></div><div><dt>멤버</dt><dd>작업 작성과 코드 검토</dd></div><div><dt>조회자</dt><dd>프로젝트 내용 조회</dd></div></dl><p>관리자 지정과 소유권 이전은 소유자만 할 수 있어요.</p></TooltipContent></Tooltip></TooltipProvider></span>{hasMemberActions && <span aria-hidden="true">관리</span>}</div>{data.items.map(member => <article className="live-member-row" key={member.userId}>
        <span className="member-monogram" aria-hidden="true">{initial(member.displayName)}</span>
        <div className="member-identity"><strong>{member.displayName}{member.self && <span className="badge">나</span>}</strong><span>@{member.login}</span></div>
        <span className={`badge member-role-${member.role.toLowerCase()}`}>{roleLabels[member.role]}</span>
        <div className="member-row-actions">
          {member.canChangeRole && <button className="button" disabled={busy} onClick={() => openAction({ type: 'role', member })} aria-label={`${member.login} 권한 변경`}>권한 변경</button>}
          {member.canRemove && <button className="subtle-link danger-text" disabled={busy} onClick={() => openAction({ type: 'remove', member })} aria-label={`${member.login} 내보내기`}>내보내기</button>}
          {member.canTransferTo && <button className="subtle-link" disabled={busy} onClick={() => openAction({ type: 'transfer', member })} aria-label={`${member.login}에게 소유권 이전`}>소유권 이전</button>}
        </div>
      </article>)}</div>
      {!data.items.length && <p className="help-text">검색한 멤버가 없어요.</p>}
      {(page > 1 || data.hasNext) && <div className="connection-pagination"><button aria-label="이전 멤버" className="button" disabled={busy || page === 1} onClick={() => setPage(value => value - 1)}><ChevronLeft size={14} />이전</button><span>{page} 페이지</span><button aria-label="다음 멤버" className="button" disabled={busy || !data.hasNext} onClick={() => setPage(value => value + 1)}>다음<ChevronRight size={14} /></button></div>}
      <div className="members-invite-layout">
      {data.canInvite && <section className="member-invitation-form" aria-label="멤버 초대"><div className="section-heading"><h3><Link2 size={17} />초대 링크 만들기</h3><span className="badge">{role === 'ADMIN' ? '관리자 · 1회 사용' : '여러 명 사용'}</span></div>
        <p className="help-text">링크를 공유하면 GitHub로 로그인한 팀원이 이 프로젝트에 참여할 수 있어요.</p>
        <form onSubmit={event => { event.preventDefault(); void makeInvitation() }}>
          <div className="member-form-columns"><label>참여 권한<select value={role} disabled={busy} onChange={event => setRole(event.target.value as MemberRole)}><option value="MEMBER">멤버 · 작업 작성</option><option value="VIEWER">조회자 · 조회만</option>{data.canInviteAdmin && <option value="ADMIN">관리자 · 멤버와 저장소 관리</option>}</select></label><label>링크 유효 기간<select value={hours} disabled={busy} onChange={event => setHours(Number(event.target.value))}><option value={1}>1시간</option><option value={24}>하루</option><option value={72}>3일</option><option value={168}>일주일</option></select></label></div>
          <button className="button button-dark" disabled={busy || loading}><Plus size={14} />{busy ? '처리 중…' : '초대 링크 만들기'}</button>
        </form>
        {created && <div className="created-invitation" role="status"><strong>초대 링크가 준비됐어요</strong><p>{roleLabels[created.invitation.role]} · {memberDate(created.invitation.expiresAt)}까지</p><label>생성한 초대 링크<input readOnly value={created.inviteUrl} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} /></label><button className="button" onClick={() => void copy()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '복사했어요' : '초대 링크 복사'}</button><p className="help-text">{created.invitation.reusable ? '이 링크 하나로 여러 팀원을 초대할 수 있어요.' : '한 명이 한 번 사용할 수 있어요.'} 화면을 떠나기 전에 복사해 주세요.</p></div>}
      </section>}
      </div>
      {secondaryError && <p className="connection-error" role="alert">{secondaryError}<button className="button" onClick={refresh}>다시 불러오기</button></p>}
      <div className="members-records-grid">
      {data.canInvite && invitations && <section className="member-invitations" aria-label="발급한 초대"><div className="section-heading"><h3>발급한 초대</h3><span className="count-text">{invitations.total}</span></div>
        {!invitations.items.length && <p className="help-text">아직 발급한 초대가 없어요.</p>}
        {invitations.items.length > 0 && <div className="member-record-scroll" tabIndex={0} aria-label="발급한 초대 목록">{invitations.items.map(invitation => <article className="invitation-list-row" key={invitation.id}><div><strong>{invitation.targetLogin ? `@${invitation.targetLogin}` : '링크로 초대'} · {roleLabels[invitation.role]}</strong><p>@{invitation.createdBy} · {memberDate(invitation.expiresAt)}까지</p><p>{invitation.reusable ? `여러 명 사용 · ${invitation.useCount ?? 0}명 참여` : '1회 사용'}</p></div><span className="badge">{invitation.reusable && invitation.status === 'PENDING' ? '사용 가능' : invitationLabels[invitation.status]}</span>{invitation.status === 'PENDING' && (invitation.role !== 'ADMIN' || data.canInviteAdmin) && <button className="button" disabled={busy} onClick={() => void revoke(invitation.id)} aria-label={`초대 ${invitation.id} 취소`}>초대 취소</button>}</article>)}</div>}
        {(invitePage > 1 || invitations.hasNext) && <div className="connection-pagination"><button aria-label="이전 초대" className="button" disabled={busy || invitePage === 1} onClick={() => setInvitePage(value => value - 1)}><ChevronLeft size={14} />이전</button><span>{invitePage} 페이지</span><button aria-label="다음 초대" className="button" disabled={busy || !invitations.hasNext} onClick={() => setInvitePage(value => value + 1)}>다음<ChevronRight size={14} /></button></div>}
      </section>}
      {data.canInvite && history && <section className="membership-history"><h3>멤버 관리 이력</h3>{history.items.length > 0 && <div className="member-record-scroll" tabIndex={0} aria-label="멤버 관리 이력 목록">{history.items.map(item => <article key={item.id}><strong>{item.title}</strong><small>@{item.actorLogin ?? '알 수 없음'} · {memberDate(item.occurredAt)}</small></article>)}</div>}{!history.items.length && <p className="help-text">아직 관리 이력이 없어요.</p>}{(historyPage > 1 || history.hasNext) && <div className="connection-pagination"><button aria-label="이전 이력" className="button" disabled={historyPage === 1} onClick={() => setHistoryPage(value => value - 1)}><ChevronLeft size={14} />이전</button><span>{historyPage} 페이지</span><button aria-label="다음 이력" className="button" disabled={!history.hasNext} onClick={() => setHistoryPage(value => value + 1)}>다음<ChevronRight size={14} /></button></div>}</section>}
      </div>
      <div className="member-leave"><p className="help-text">프로젝트를 나가도 기존 작업 기록은 유지돼요. 소유자는 다른 멤버에게 소유권을 먼저 이전해야 합니다.</p><button className="subtle-link danger-text" disabled={busy || data.canInviteAdmin} onClick={() => openAction({ type: 'leave' })}>프로젝트 나가기</button></div>
    </>}
    {!data && !loading && <Link className="subtle-link" to="/issues">내 프로젝트로 돌아가기</Link>}
    {action && <div className="dialog-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) setAction(null) }}><div className="dialog member-action-dialog" role="dialog" aria-modal="true" aria-labelledby="member-action-title" ref={modal} tabIndex={-1}>
      <div className="dialog-header"><span className="eyebrow">프로젝트 권한 관리</span><button className="icon-button" aria-label="권한 관리 창 닫기" disabled={busy} onClick={() => setAction(null)}><X size={18} /></button></div>
      <div className="dialog-form"><h2 id="member-action-title">{actionTitle}</h2>
        {action.type === 'role' ? <><p>@{action.member.login} 님의 프로젝트 권한을 변경합니다.</p><label>변경할 권한<select value={nextRole} disabled={busy} onChange={event => setNextRole(event.target.value as MemberRole)}><option value="MEMBER">멤버</option><option value="VIEWER">조회자</option>{data?.canInviteAdmin && <option value="ADMIN">관리자</option>}</select></label></>
          : action.type === 'remove' ? <p>@{action.member.login} 님을 내보내면 이 프로젝트에 접근할 수 없어요. 다시 참여하려면 새로운 초대가 필요합니다.</p>
            : action.type === 'transfer' ? <p>@{action.member.login} 님이 새 소유자가 됩니다. 나는 관리자로 남으며, 소유권을 되돌리려면 새 소유자의 이전이 필요해요. 내가 발급한 미사용 초대도 취소됩니다.</p>
              : <p>프로젝트에서 나가면 이 공간을 볼 수 없어요. 내가 발급한 미사용 초대가 취소되며, 다시 참여하려면 새로운 초대가 필요합니다.</p>}
        {actionError && <p className="connection-error" role="alert">{actionError}</p>}
        {stale && <button className="button" disabled={busy} onClick={() => { setAction(null); refresh() }}>최신 목록 다시 확인</button>}
        <div className="form-actions"><button className="button" disabled={busy} onClick={() => setAction(null)}>취소</button><button className={`button ${action.type === 'role' ? 'button-dark' : 'button-danger'}`} disabled={busy || stale || action.type === 'role' && nextRole === action.member.role} onClick={() => void confirmAction()}>{busy ? '처리 중…' : actionTitle}</button></div>
      </div>
    </div></div>}
  </section>
}
