import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, Copy, ExternalLink, Github, Link2, Users } from 'lucide-react'
import { useSession } from '../hooks/use-session'
import { RepositoryConnections } from './repository-connections'
import { listProjects, listConnectedRepositories } from '../lib/project-api'
import type { Project, ProjectDraft } from '../lib/project-api'
import { createInvitation, projectDetail, memberDate } from '../lib/members-api'
import type { CreatedInvitation } from '../lib/members-api'
import { preferredProject, rememberProjectForUser, selectProjectForUser } from '../lib/workspace'
import { projectWeekCount, projectWeeks, today, weekLabel, validProjectPeriod } from '../lib/work-weeks'
import { BrandMark } from './brand-mark'
import { LoadingState } from './loading-state'
import './onboarding.css'

type DraftState = ProjectDraft & { attempted: boolean; step: 1 | 2 }
function loadDraft(userId: string): DraftState {
  try {
    const stored = JSON.parse(sessionStorage.getItem(`zello.project-setup.${userId}`) ?? 'null') as DraftState | null
    if (stored && typeof stored.name === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(stored.startDate) && (!stored.endDate || /^\d{4}-\d{2}-\d{2}$/.test(stored.endDate)) && /^[A-Za-z0-9-]{16,64}$/.test(stored.requestKey)) return { ...stored, attempted: stored.attempted === true, step: stored.step === 2 ? 2 : 1 }
  } catch { /* A fresh draft remains usable if storage is unavailable. */ }
  return { name: '', startDate: today(), endDate: '', requestKey: crypto.randomUUID(), attempted: false, step: 1 }
}
export function Onboarding() {
  const session = useSession()
  if (session.status === 'ready' && !session.user) return <Navigate to="/login" replace />
  if (!session.user) return <main className="onboarding-page"><LoadingState layout="detail" label="로그인 정보를 확인하는 중" />{session.status === 'unavailable' && <div className="connection-error" role="alert">{session.error}<button className="button" onClick={() => void session.refresh()}>다시 확인</button></div>}</main>
  return <ProjectSetup key={session.user.id} userId={session.user.id} displayName={session.user.displayName} onLogout={() => session.logout()} />
}

function ProjectSetup({ userId, displayName, onLogout }: { userId: string; displayName: string; onLogout: () => Promise<void> }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const newProject = params.get('new') === '1'
  const resumeId = useRef(params.get('project'))
  const resumeInvite = useRef(params.get('step') === 'invite')
  const [draft, setDraft] = useState<DraftState>(() => loadDraft(userId))
  const [step, setStep] = useState<1 | 2 | 3>(() => resumeId.current ? resumeInvite.current ? 3 : 2 : draft.step)
  const [project, setProject] = useState<Project | null>(null)
  const [choice, setChoice] = useState<'existing' | 'new' | null>(() => resumeId.current ? 'existing' : null)
  const [checking, setChecking] = useState(true)
  const [existing, setExisting] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [connecting, setConnecting] = useState(false)
  const [invitation, setInvitation] = useState<CreatedInvitation | null>(null)
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [copied, setCopied] = useState(false)
  const mounted = useRef(true)
  const invitePending = useRef(false)
  const completed = useRef(false)
  const creationStarted = useCallback(() => setDraft(value => value.attempted ? value : { ...value, attempted: true }), [])
  const period = project?.startDate && project.endDate ? project : draft
  const count = projectWeekCount(period)
  const periodValid = validProjectPeriod(draft)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    try { sessionStorage.setItem(`zello.project-setup.${userId}`, JSON.stringify(draft)) } catch { /* Optional resume state. */ }
  }, [draft, userId])
  useEffect(() => {
    const controller = new AbortController()
    setChecking(true); setError('')
    if (resumeId.current) {
      void projectDetail(resumeId.current, controller.signal).then(async value => {
        if (controller.signal.aborted) return
        if (!value.canManageRepositories) { navigate('/issues', { replace: true }); return }
        setProject(value); selectProjectForUser(userId, value.id)
        if (resumeInvite.current) {
          const repos = await listConnectedRepositories(value.id, controller.signal)
          if (!controller.signal.aborted && !repos.length) { setStep(2); setParams({ new: '1', project: value.id, step: 'repository' }, { replace: true }) }
        }
      }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '만들던 프로젝트를 확인하지 못했어요.') })
        .finally(() => { if (!controller.signal.aborted) setChecking(false) })
    } else if (newProject) setChecking(false)
    else void listProjects(controller.signal).then(items => {
      if (controller.signal.aborted) return
      const preferred = preferredProject(userId)
      const current = preferred ? items.find(item => item.id === preferred) : items[0]
      if (current) rememberProjectForUser(userId, current.id)
      setExisting(items.length > 0)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '프로젝트를 확인하지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [userId, newProject, revision, navigate])
  function projectCreated(value: Project) {
    if (!mounted.current) return
    setProject(value)
    setParams({ new: '1', project: value.id, step: 'repository' }, { replace: true })
  }
  async function invite(value: Project) {
    if (invitePending.current) return
    invitePending.current = true; setInviting(true); setInviteError(''); setCopied(false)
    try { const result = await createInvitation(value.id, 'MEMBER', 72, null); if (mounted.current) setInvitation(result) }
    catch (cause) { if (mounted.current) setInviteError(cause instanceof Error ? cause.message : '초대 링크를 만들지 못했어요. 프로젝트는 그대로 준비돼 있어요.') }
    finally { invitePending.current = false; if (mounted.current) setInviting(false) }
  }
  function ready(value: Project) {
    if (!mounted.current || completed.current) return
    completed.current = true
    setProject(value); setStep(3); setConnecting(false)
    setParams({ new: '1', project: value.id, step: 'invite' }, { replace: true })
    try { sessionStorage.removeItem(`zello.project-setup.${userId}`) } catch { /* Nothing to clear. */ }
    void invite(value)
  }
  async function copy() {
    if (!invitation) return
    try { await navigator.clipboard.writeText(invitation.inviteUrl); setCopied(true) }
    catch { setInviteError('자동 복사가 되지 않았어요. 아래 링크를 선택해 복사해 주세요.') }
  }
  function enter() {
    if (!project) return
    selectProjectForUser(userId, project.id)
    try { sessionStorage.removeItem(`zello.project-setup.${userId}`) } catch { /* Nothing to clear. */ }
    navigate('/issues', { replace: true })
  }
  if (existing && !newProject && !resumeId.current) return <Navigate to="/settings?tab=repositories" replace />
  const titles = ['함께할 프로젝트를 준비해요', '어떤 저장소로 시작할까요?', '이제 팀원을 초대해요']
  return <main className="onboarding-page project-setup-page" data-step={step}>
    <header className="section-heading"><Link className="public-brand" to="/"><BrandMark />zello</Link><div className="issue-actions"><span>{displayName}</span><button className="subtle-link" disabled={connecting || inviting} onClick={() => void onLogout().catch(cause => setError(cause instanceof Error ? cause.message : '로그아웃하지 못했어요.'))}>로그아웃</button></div></header>
    <nav className="setup-steps" aria-label="프로젝트 시작 단계">{['프로젝트와 기간', '저장소 연결', '팀원 초대'].map((label, index) => <div key={label} aria-current={step === index + 1 ? 'step' : undefined} className={step > index + 1 ? 'is-complete' : ''}><span>{step > index + 1 ? <Check size={13} /> : index + 1}</span>{label}</div>)}</nav>
    <div className="onboarding-intro"><span className="eyebrow">{step === 3 ? '함께 시작할 준비가 됐어요' : '회의에서 정한 일부터, 팀의 다음 변화까지'}</span><h1>{titles[step - 1]}</h1><p>{step === 1 ? '프로젝트 기간을 정하면 1주차부터 마지막 주차까지 자동으로 준비해요.' : step === 2 ? '기존 GitHub 저장소를 연결하거나 새로 만든 뒤 돌아와 연결하세요.' : '초대받은 팀원은 GitHub로 가입·로그인한 뒤 이 프로젝트에 참여할 수 있어요.'}</p></div>
    {error && <div className="connection-error" role="alert">{error}<button className="button" onClick={() => setRevision(value => value + 1)}>다시 확인</button></div>}
    {checking ? <LoadingState layout="detail" label="프로젝트를 확인하는 중" /> : !error && <>
      {step === 1 && <form className="setup-period-form" onSubmit={event => { event.preventDefault(); if (!periodValid || !draft.name.trim()) return; setDraft(value => ({ ...value, name: value.name.trim(), step: 2 })); setStep(2) }}>
        <label>프로젝트 이름<input required autoFocus maxLength={100} value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} placeholder="예: zello 졸업 프로젝트" /></label>
        <div className="setup-date-fields"><label>프로젝트 시작일<input required type="date" value={draft.startDate} onChange={event => setDraft(value => ({ ...value, startDate: event.target.value }))} /></label><label>프로젝트 종료일<input required type="date" min={draft.startDate} value={draft.endDate} onChange={event => setDraft(value => ({ ...value, endDate: event.target.value }))} /></label></div>
        {periodValid ? <div className="setup-week-preview"><CalendarDays size={20} /><div><strong>{count}주 동안 함께해요</strong><p>시작일부터 7일씩 나누고, 날짜에 맞춰 이번 주차를 자동으로 보여줘요.</p><div className="setup-week-chips">{projectWeeks(draft).slice(0, 3).map((value, index) => <span key={value}>{index + 1}주차 <small>{weekLabel(value, draft)}</small></span>)}{count > 3 && <span>… {count}주차까지</span>}</div></div></div> : draft.endDate && <p className="form-error" role="alert">종료일은 시작일 이후로, 기간은 10년 이내로 선택해 주세요.</p>}
        <button className="button button-dark setup-next" disabled={!draft.name.trim() || !periodValid}>저장소 선택하기<ArrowRight size={16} /></button>
      </form>}
      {step === 2 && <>
        <div className="setup-project-summary"><span className="setup-summary-icon"><CalendarDays size={20} /></span><div><strong>{project?.name ?? draft.name}</strong><p>{period.startDate} – {period.endDate} · 전체 {count}주</p></div>{!project && !draft.attempted && <button className="subtle-link" onClick={() => { setStep(1); setDraft(value => ({ ...value, step: 1 })) }} disabled={connecting}>수정하기</button>}</div>
        {!choice && <div className="setup-repository-choices"><button type="button" onClick={() => setChoice('existing')}><Github size={24} /><strong>이미 저장소가 있어요</strong><p>팀이 사용하던 저장소를 연결해요.</p><ArrowRight size={18} /></button><button type="button" onClick={() => setChoice('new')}><Link2 size={24} /><strong>새로 시작할래요</strong><p>GitHub에 저장소를 만든 뒤 연결해요.</p><ArrowRight size={18} /></button></div>}
        {choice === 'new' && <div className="setup-create-repository"><Github size={30} /><h2>GitHub에서 저장소를 먼저 만들어요</h2><p>개인 계정이나 팀 Organization에 저장소를 만들고 돌아오세요.<br />완료한 뒤 목록에서 선택하면 프로젝트와 연결돼요.</p><a className="button button-dark" href="https://github.com/new" target="_blank" rel="noopener noreferrer">GitHub에서 저장소 만들기<ExternalLink size={15} /></a><button className="button" onClick={() => setChoice('existing')}>만들었어요, 저장소 연결하기<ArrowRight size={15} /></button></div>}
        {choice === 'existing' && <RepositoryConnections project={project ?? undefined} onboarding userId={userId} draft={draft} onProjectCreated={projectCreated} onCreationStart={creationStarted} onBusyChange={setConnecting} onComplete={ready} />}
        {choice && !project && !draft.attempted && <button className="subtle-link setup-back" disabled={connecting} onClick={() => setChoice(null)}><ArrowLeft size={14} />다른 방식으로 시작</button>}
      </>}
      {step === 3 && project && <div className="setup-invite-card"><span className="setup-ready-icon"><CheckCircle2 size={30} /></span><h2>{project.name} 준비 완료</h2><p>{project.totalWeeks ?? count}개의 주차가 준비됐어요. 이제 팀원과 함께 시작하세요.</p>
        {inviting ? <LoadingState rows={2} label="초대 링크를 준비하는 중" /> : invitation ? <><label>팀원 초대 링크<input readOnly value={invitation.inviteUrl} onFocus={event => event.target.select()} /></label><button className="button full-width" onClick={() => void copy()}><Copy size={15} />{copied ? '링크를 복사했어요' : '초대 링크 복사'}</button><p className="setup-invite-help">{memberDate(invitation.invitation.expiresAt)}까지 · 한 사람이 한 번 사용할 수 있어요.<br />팀원은 멤버 권한으로 참여해요. GitHub 저장소 접근 권한도 별도로 설정해 주세요.</p><button className="subtle-link" onClick={() => { setInvitation(null); void invite(project) }}><Users size={14} />다른 팀원 초대 링크 만들기</button></> : <button className="button full-width" onClick={() => void invite(project)}><Users size={15} />초대 링크 만들기</button>}
        {inviteError && <div className="connection-error" role="alert">{inviteError}{!inviting && <button className="button" onClick={() => void invite(project)}>다시 시도</button>}</div>}
        <button className="button button-dark full-width setup-next" disabled={inviting} onClick={enter}>프로젝트 시작하기<ArrowRight size={16} /></button><small>나중에도 프로젝트 설정에서 팀원을 초대할 수 있어요.</small>
      </div>}
    </>}
    {step !== 3 && (connecting ? <span className="subtle-link setup-back muted" aria-disabled="true">프로젝트를 준비하고 있어요…</span> : <Link className="subtle-link setup-back" to="/issues">나중에 준비하기</Link>)}
  </main>
}
