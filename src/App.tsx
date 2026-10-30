import { useEffect, useMemo, useRef, useState } from 'react'
import { useTheme } from './hooks/use-theme'
import { BrandMark } from './components/brand-mark'
import type { FormEvent, ReactNode, CSSProperties } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot,
  Clock3, Copy, FileText, GitBranch, GitCommitHorizontal, GitMerge, GitPullRequest,
  Github, Layers3, LayoutDashboard, Moon, Sun, Plus, RefreshCw, Rocket,
  Search, SlidersHorizontal, Users, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SidebarProvider, SidebarTrigger, SidebarInset } from './components/ui/sidebar'
import { SectionCards } from './components/section-cards'
import { ActivityTable } from './components/activity-table'
import { Button } from './components/ui/button'
import { InboxPanel, InboxPreview } from './components/inbox-panel'
import { MyWorkPanel } from './components/my-work-panel'
import { createInitialInbox } from './data/inbox'
import type { InboxItem } from './data/inbox'
import { WorkspaceSidebar } from './components/workspace-sidebar'
import { ActivityChart } from './components/activity-chart'
import { IssuesPanel, IssueEditor } from './components/issues-panel'
import { PullRequestsPanel } from './components/pull-requests-panel'
import { CreatePullRequest } from './components/create-pull-request'
import type { PullRequestDraft } from './components/create-pull-request'
import { PullRequestDetail } from './components/pull-request-detail'
import { initialIssues, initialPullRequests, hydrateIssue, hydratePullRequest, needsMyReview, CURRENT_USER, nextRepositoryNumber, repositoryRef, issueAttention } from './data/work-items'
import type { Issue, PullRequest } from './data/work-items'
import ContributionSkyline, { generateContributions } from './components/ui/contribution-skyline'
import type { ContributionDay } from './components/ui/contribution-skyline'
import { activities, categoryLabels, dateLabel, initialNotes, initialRepos, inPeriod, members, periods, sortedActivities, typeLabels } from './data/mock'
import type { Activity, PatchNote, Period, Repo } from './data/mock'

const navItems: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/inbox', label: '알림함', icon: Bell },
  { to: '/my-work', label: '내 작업', icon: CircleDot },
  { to: '/', label: '전체 현황', icon: LayoutDashboard },
  { to: '/issues', label: '팀 작업', icon: CircleDot },
  { to: '/pull-requests', label: '코드 검토', icon: GitPullRequest },
  { to: '/changes', label: '변경 소식', icon: BookOpen },
  { to: '/changes?view=history', label: '개발 타임라인', icon: GitBranch },
  { to: '/settings?tab=repositories', label: '저장소', icon: Layers3 },
  { to: '/deployments', label: '빌드와 배포', icon: Rocket },
  { to: '/settings', label: '프로젝트 설정', icon: SlidersHorizontal },
]
const eventIcons = { merge: GitMerge, commit: GitCommitHorizontal, pr: GitPullRequest, issue: CircleDot, deploy: Rocket }
const CHART_PALETTE = { light: ['#DDE5FF', '#AEBFFF', '#6C8BFF', '#2F5BFF'], dark: ['#263557', '#3E568D', '#5876C3', '#7C9BFF'] }
const END_MS = Date.UTC(2026, 9, 27)

// Update saved demo branding and issue references while preserving local edits.
function migrateProjectText(value: string) {
  return value.replace(/\bmoa-/gi, prefix => prefix === prefix.toUpperCase() ? 'ZELLO-' : 'zello-')
    .replace(/모아(?= 프로젝트| 팀| 서비스| 웹|가 서비스|의|$)/g, 'zello')
}

function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored, (_key, value: unknown) => typeof value === 'string' ? migrateProjectText(value) : value) as T : initial
    } catch { return initial }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Storage may be unavailable in private browsing. */ }
  }, [key, value])
  return [value, setValue] as const
}
function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  const member = members.find(m => m.name === name) ?? members[0]
  return <span className={`avatar ${small ? 'avatar-small' : ''}`} style={{ '--avatar-bg': member.color } as CSSProperties} title={name}>{member.initials}</span>
}
function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}
function Empty({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state"><Layers3 size={28} strokeWidth={1.3} /><h3>{title}</h3><p>{description}</p>{action}</div>
}
function Dialog({ title, children, onClose, drawer = false, wide = false }: { title: string; children: ReactNode; onClose: () => void; drawer?: boolean; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const old = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus()
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab') return
      const focusables = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, textarea, select, [tabindex="0"]')
      if (!focusables?.length) return
      const first = focusables[0], last = focusables[focusables.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', keydown)
    return () => { document.body.style.overflow = old; document.removeEventListener('keydown', keydown); previous?.focus() }
  }, [])
  return <div className={`dialog-backdrop ${drawer ? 'drawer-backdrop' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={`${drawer ? 'drawer' : 'dialog'} ${wide ? 'dialog-wide' : ''}`}>
      <div className="dialog-header"><span className="eyebrow">{title}</span><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></div>
      {children}
    </div>
  </div>
}
function ActivityRow({ item, repos, onSelect, compact = false }: { item: Activity; repos: Repo[]; onSelect: (a: Activity) => void; compact?: boolean }) {
  const Icon = eventIcons[item.type]
  return <button className={`activity-row ${compact ? 'activity-compact' : ''}`} onClick={() => onSelect(item)}>
    <span className={`event-icon event-${item.type}`}><Icon size={16} strokeWidth={1.7} /></span>
    <span className="activity-reference mono">{item.ref}</span>
    <span className="activity-copy"><span className="activity-title">{item.title}</span><span className="activity-meta"><span className="activity-repository">{repos.find(r => r.id === item.repo)?.name ?? item.repo}</span><i /><span className={`activity-type activity-type-${item.type}`}>{typeLabels[item.type]}</span></span></span>
    <span className="activity-trailing"><span>{dateLabel(item.date) === '오늘' ? item.time : dateLabel(item.date)}</span><Avatar name={item.author} small /></span>
    <ChevronRight size={14} className="row-chevron" />
  </button>
}
function RepoCard({ repo, activityCount, onClick }: { repo: Repo; activityCount: number; onClick: () => void }) {
  return <button className="repo-card" onClick={onClick}>
    <div className="repo-card-head"><span className={`repo-glyph repo-${repo.id}`}><Github size={19} /></span><ArrowUpRight size={17} className="muted" /></div>
    <h3>{repo.name}</h3><p>{repo.description}</p>
    <div className="repo-card-foot"><span><i className="language-dot" style={{ background: repo.color }} />{repo.language}</span><span className="repo-branch"><GitBranch size={12} />{repo.branch}</span></div>
    <div className="repo-card-status"><span><i className={`status-dot ${repo.build === 'failed' ? 'dot-red' : repo.build === 'unknown' ? 'dot-gray' : ''}`} />{repo.build === 'failed' ? '빌드 확인 필요' : repo.build === 'unknown' ? '아직 수집한 활동이 없어요' : '정상적으로 동기화 중'}</span><span>{activityCount}개 활동</span></div>
  </button>
}
function PatchPreview({ note, onRead }: { note: PatchNote; onRead: () => void }) {
  const changes = note.activityIds.map(id => activities.find(a => a.id === id)).filter((a): a is Activity => Boolean(a))
  return <article className="patch-preview">
    <div className="patch-eyebrow"><span><BookOpen size={12} /> RELEASE NOTES</span><span>No. {note.id === 'week-43' ? '043' : note.version}</span></div>
    <div className="patch-date"><span className="little-line" />{note.subtitle}</div>
    <h3>{note.title}</h3>
    <p className="patch-intro">{note.summary}</p>
    <div className="patch-items">{changes.slice(0, 3).map(item => <div className="patch-mini-item" key={item.id}><span className={`category-dot category-${item.noteType}`} /><span><small>{item.noteType ? categoryLabels[item.noteType] : '변경 사항'}</small><p>{item.title}</p></span></div>)}</div>
    <button className="patch-read" onClick={onRead}>변경 사항 읽기 <ArrowRight size={17} /></button>
  </article>
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [repos, setRepos] = useStored<Repo[]>('gyeol.repositories.v1', initialRepos)
  const [notes, setNotes] = useStored<PatchNote[]>('gyeol.notes.v1', initialNotes)
  const [storedIssues, setIssues] = useStored<Issue[]>('gyeol.issues.v1', initialIssues)
  const issues = useMemo(() => storedIssues.map(hydrateIssue), [storedIssues])
  const [storedPullRequests, setPullRequests] = useStored<PullRequest[]>('gyeol.pullrequests.v1', initialPullRequests)
  const pullRequests = useMemo(() => storedPullRequests.map(hydratePullRequest), [storedPullRequests])
  const [prIssue, setPrIssue] = useState<Issue | null>(null)
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null)
  const [selectedPr, setSelectedPr] = useState<PullRequest | null>(null)
  const [repoFilter, setRepoFilter] = useState('all')
  const isWorkPage = ['/issues', '/pull-requests', '/my-work'].includes(location.pathname)
  const searchParams = new URLSearchParams(location.search)
  const changesView = searchParams.get('view') === 'history' ? 'history' : 'updates'
  const settingsTab = ['general', 'members', 'repositories', 'sync'].includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : 'general'
  const showScope = !['/inbox', '/settings', '/repositories'].includes(location.pathname)
  function openIssue(issue: Issue | null) { setEditingIssue(issue); setModal('issue') }
  function openPr(issue: Issue | null = null) { setPrIssue(issue); setModal('pr') }
  const [period, setPeriod] = useState<Period>('week')
  const requestedType = new URLSearchParams(location.search).get('type')
  const eventFilter = requestedType && ['merge', 'commit', 'pr', 'issue', 'deploy'].includes(requestedType) ? requestedType : 'all'
  function setEventFilter(type: string) {
    navigate(`/changes?view=history${type === 'all' ? '' : `&type=${type}`}`)
  }
  const [patchFilter, setPatchFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState<'repo' | 'search' | 'note' | 'guide' | 'issue' | 'pr' | null>(null)
  const [detail, setDetail] = useState<Activity | null>(null)
  const [noteDetail, setNoteDetail] = useState<PatchNote | null>(null)
  const [day, setDay] = useState<ContributionDay | null>(null)
  const [theme, setTheme] = useTheme()
  const [notifications, setNotifications] = useState(false)
  const [inbox, setInbox] = useStored<InboxItem[]>('gyeol.inbox.isu-bin.v1', createInitialInbox())
  const myInbox = inbox.filter(item => item.recipient === CURRENT_USER)
  const unreadCount = myInbox.filter(item => !item.readAt).length
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('14:45')
  const [toast, setToast] = useState('')
  const [year, setYear] = useState('2026')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function notify(message: string) {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3500)
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); if (syncTimer.current) clearTimeout(syncTimer.current) }, [])
  useEffect(() => {
    const legacyTitles = ['더 편하게 모으고,\n함께 나눌 수 있도록.', '다음 변화를 준비하고 있어요', '내 취향대로 정리하는 즐거움.', '좋아하는 것을 모으는 일이\n조금 더 가벼워졌어요.']
    setNotes(current => current.map(note => {
      const sample = initialNotes.find(n => n.id === note.id)
      if (!sample || !legacyTitles.includes(note.title)) return note
      const legacySummary = note.summary === '혼자 모으던 자료가 함께 나누는 이야기가 됩니다. 이번 주에는 컬렉션 공유를 더하고, 일상 속 작은 불편을 다듬었어요.' || note.summary === '저장은 간단하게, 목록은 깔끔하게. zello의 기본 경험을 차근차근 다듬었습니다.'
      return { ...note, title: sample.title, subtitle: note.subtitle === '아직 공개하지 않은 이야기' ? sample.subtitle : note.subtitle, summary: legacySummary ? sample.summary : note.summary }
    }))
    setRepos(current => current.map(repo => {
      const sample = initialRepos.find(r => r.id === repo.id)
      return sample && ['함께 모으는 즐거움, zello의 웹 서비스', '컬렉션과 공유를 연결하는 API 서버', 'zello의 일관된 경험을 만드는 컴포넌트'].includes(repo.description) ? { ...repo, description: sample.description } : repo
    }))
  }, [setNotes, setRepos])
  useEffect(() => { document.title = '워크스페이스 · zello' }, [])
  useEffect(() => { setNotifications(false); window.scrollTo({ top: 0, behavior: 'instant' }) }, [location.pathname])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setModal('search') }
      if (e.key === 'Escape') { setNotifications(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  const repoActivities = useMemo(() => sortedActivities.filter(a => repoFilter === 'all' || a.repo === repoFilter), [repoFilter])
  const filteredActivities = useMemo(() => repoActivities.filter(a => inPeriod(a, period)), [repoActivities, period])
  const visibleNotes = notes.filter(n => inPeriod(n, period) && (repoFilter === 'all' || n.activityIds.some(id => activities.find(a => a.id === id)?.repo === repoFilter)))
  const visibleRepos = repos.filter(r => repoFilter === 'all' || r.id === repoFilter)
  const merged = filteredActivities.filter(a => a.type === 'merge').length
  const scopedIssues = issues.filter(issue => repoFilter === 'all' || issue.repo === repoFilter)
  const scopedPullRequests = pullRequests.filter(pr => repoFilter === 'all' || pr.repo === repoFilter)
  const activeIssues = scopedIssues.filter(issue => issue.status !== 'done')
  const unassigned = activeIssues.filter(issue => !issue.assignee).length
  const unlinked = activeIssues.filter(issue => !pullRequests.some(pr => issue.pullRequestIds.includes(pr.id))).length
  const reviewing = scopedPullRequests.filter(pr => pr.status === 'open' && pr.review === 'pending').length
  const currentNav = navItems.find(n => n.to === location.pathname)
  const heading = currentNav?.label ?? 'zello'
  const myWorkCount = activeIssues.filter(issue => issue.assignee === CURRENT_USER).length + scopedPullRequests.filter(pr => needsMyReview(pr) || pr.author === CURRENT_USER && ['open', 'draft'].includes(pr.status)).length
  const chartData = useMemo(() => {
    const end = year === '2026' ? END_MS : Date.UTC(2025, 11, 31)
    const seeds: Record<string, number> = { web: 7, api: 19, design: 25 }
    const selectedIds = repoFilter === 'all' ? initialRepos.map(r => r.id) : [repoFilter]
    const counts = new Map<string, number>()
    for (const id of selectedIds) {
      if (!seeds[id]) continue
      for (const d of generateContributions(end, seeds[id], 371)) {
        if (d.date.startsWith(year)) counts.set(d.date, (counts.get(d.date) ?? 0) + Math.floor(d.count * .48))
      }
    }
    return generateContributions(end, 7, 371).filter(d => d.date.startsWith(year)).map(d => ({ date: d.date, count: counts.get(d.date) ?? 0 }))
  }, [repoFilter, year])
  const contributionTotal = chartData.reduce((n, d) => n + d.count, 0)
  const searchResults = sortedActivities.filter(a => query.trim() && `${a.title} ${a.summary} ${a.ref} ${a.author} ${repos.find(r => r.id === a.repo)?.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
  const commands: { label: string; description: string; icon: LucideIcon; run: () => void }[] = [
    ...navItems.map(item => ({ label: item.label, description: '화면으로 이동', icon: item.icon, run: () => { navigate(item.to); setModal(null); setQuery('') } })),
    { label: '이슈 만들기', description: '새 작업과 담당자 정하기', icon: CircleDot, run: () => { setQuery(''); openIssue(null) } },
    { label: 'PR 작성', description: '이슈와 작업 브랜치 연결하기', icon: GitPullRequest, run: () => { setQuery(''); openPr() } },
    { label: '패치노트 작성', description: 'PR 요약으로 새 초안 만들기', icon: FileText, run: () => { setQuery(''); setModal('note') } },
    { label: '저장소 연결', description: 'GitHub 저장소 추가', icon: Plus, run: () => { setQuery(''); setModal('repo') } },
  ]
  const matchingIssues = issues.filter(issue => query.trim() && `${issue.id} ${repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)} ${issue.title} ${issue.description} ${issue.assignee}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
  const matchingCommands = commands.filter(command => !query.trim() || command.label.toLowerCase().includes(query.trim().toLowerCase()))
  function sync() {
    if (syncing) return
    setSyncing(true)
    syncTimer.current = setTimeout(() => { setSyncing(false); setLastSync('방금'); notify('목데이터를 새로 확인했어요. 실제 GitHub에는 연결되지 않습니다.') }, 850)
  }
  function openRepo(repo: Repo) { setRepoFilter(repo.id); navigate('/changes?view=history') }
  function updateNote(note: PatchNote) {
    setNotes(current => current.map(n => n.id === note.id ? note : n))
    setNoteDetail(note)
  }
  function createPullRequest(draft: PullRequestDraft) {
    const { issueIds, ...values } = draft
    const number = nextRepositoryNumber(values.repo, issues, pullRequests)
    const pr: PullRequest = { ...values, id: `${values.repo}-${number}`, number }
    setPullRequests(current => [pr, ...current])
    setIssues(current => current.map(issue => issueIds.includes(issue.id) ? { ...issue, pullRequestIds: [...new Set([...issue.pullRequestIds, pr.id])], status: values.status === 'draft' ? 'in_progress' : 'in_review' } : issue))
    setRepoFilter(values.repo)
    setModal(null)
    navigate('/pull-requests')
    setSelectedPr(pr)
    notify(`${repositoryRef(pr.repo, pr.number, repos)}를 데모 PR로 등록했어요.`)
  }
  function setNotificationRead(id: string, read: boolean) {
    setInbox(current => current.map(item => item.id === id && item.recipient === CURRENT_USER ? { ...item, readAt: read ? item.readAt ?? new Date().toISOString() : null } : item))
  }
  function readAllNotifications() {
    setInbox(current => current.map(item => item.recipient === CURRENT_USER && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item))
  }
  function openNotification(item: InboxItem) {
    if (item.recipient !== CURRENT_USER) return
    const target = item.target
    if (target.type === 'issue') {
      const issue = issues.find(issue => issue.id === target.id)
      if (!issue) { notify('연결된 작업을 찾지 못했어요. 알림은 미확인 상태로 남겨둘게요.'); return }
      openIssue(issue)
    } else if (target.type === 'pr') {
      const pr = pullRequests.find(pr => pr.id === target.id)
      if (!pr) { notify('연결된 PR을 찾지 못했어요. 알림은 미확인 상태로 남겨둘게요.'); return }
      setSelectedPr(pr)
    } else {
      const activity = activities.find(activity => activity.id === target.id)
      if (!activity) { notify('연결된 기록을 찾지 못했어요. 알림은 미확인 상태로 남겨둘게요.'); return }
      setDetail(activity)
    }
    setNotificationRead(item.id, true)
    setNotifications(false)
  }
  const repositoryControl = <label className="select-wrap header-scope"><Github size={14} /><select aria-label="저장소 필터" value={repoFilter} onChange={e => setRepoFilter(e.target.value)}><option value="all">모든 저장소</option>{repos.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select><ChevronDown size={13} /></label>
  const filterControls = <div className="filter-controls">{!isWorkPage && <label className="select-wrap period-select"><CalendarDays size={14} /><select aria-label="조회 기간" value={period} onChange={e => setPeriod(e.target.value as Period)}>{Object.entries(periods).map(([value, p]) => <option key={value} value={value}>{p.range}</option>)}</select><ChevronDown size={13} /></label>}</div>
  const subtitle = location.pathname === '/' ? '회의에서 정한 일부터 코드 검토와 변경 사항까지, 프로젝트의 흐름을 확인하세요.' : location.pathname === '/inbox' ? '내게 온 요청과 소식이에요. 내용을 열거나 읽음으로 표시하면 미확인 목록에서 사라집니다.' : location.pathname === '/my-work' ? '내가 맡은 작업, 요청받은 코드 검토와 내가 올린 PR을 모았어요.' : location.pathname === '/issues' ? '회의에서 정한 팀의 작업, 담당자와 연결된 PR을 함께 확인하세요.' : location.pathname === '/pull-requests' ? '어떤 작업을 해결하는 PR인지, 검토와 자동 검사 상태를 확인하세요.' : location.pathname === '/changes' ? '팀 업데이트로 결과를 공유하고, 개발 기록에서 변경 과정을 확인하세요.' : location.pathname === '/deployments' ? '빌드 결과와 서비스 배포 상태를 구분해서 확인하세요.' : '프로젝트 정보, 멤버, 연결된 저장소와 동기화 설정을 관리하세요.'

  return <SidebarProvider className="app-shell" style={{ '--sidebar-width': '256px' } as CSSProperties}>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>본문으로 이동</a>
    <WorkspaceSidebar unreadCount={unreadCount} myWorkCount={myWorkCount} pullRequestCount={scopedPullRequests.filter(pr => ['open', 'draft'].includes(pr.status)).length} issueCount={activeIssues.length} onGuide={() => setModal('guide')} onSearch={() => setModal('search')} onCreate={() => openIssue(null)} />
    <SidebarInset className="app-body">
      <header className="topbar"><SidebarTrigger className="sidebar-trigger" aria-label="메뉴 열기 또는 닫기" /><div className="breadcrumb"><span className="project-mini"><BrandMark /></span><span>zello</span><ChevronRight size={12} /><strong>{heading}</strong></div>{showScope && repositoryControl}<div className="topbar-actions"><button className="search-trigger" onClick={() => setModal('search')}><Search size={16} /><span>검색 및 빠른 이동</span><kbd>⌘ K</kbd></button><span className="topbar-divider" /><Button variant="ghost" size="icon-sm" className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? '어두운 테마로 전환' : '밝은 테마로 전환'} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>{theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}</Button><div className="notification-anchor"><button className="icon-button notification-button" aria-label="알림" aria-expanded={notifications} onClick={() => setNotifications(v => !v)}><Bell size={18} />{unreadCount > 0 && <span className="unread-badge" aria-hidden="true">{unreadCount}</span>}</button>{notifications && <InboxPreview items={myInbox} repos={repos} onOpen={openNotification} />}</div><div className="top-avatar"><Avatar name={CURRENT_USER} small /></div></div></header>
      <div id="main-content" tabIndex={-1} className="main-content">
        <div className="page-heading"><div><div className="page-eyebrow">샘플 프로젝트 <span className="badge badge-neutral">팀 워크스페이스</span></div><h1>{heading}<span className="heading-dot">.</span></h1><p>{subtitle}</p></div><div className="heading-actions">{location.pathname === '/pull-requests' ? <button className="button button-dark" onClick={() => openPr()}><Plus size={15} />PR 작성</button> : ['/', '/issues'].includes(location.pathname) ? <button className="button button-dark" onClick={() => openIssue(null)}><Plus size={15} />이슈 만들기</button> : location.pathname === '/settings' && settingsTab === 'repositories' ? <button className="button button-dark" onClick={() => setModal('repo')}><Plus size={15} />저장소 연결</button> : location.pathname === '/changes' && changesView === 'updates' ? <button className="button button-dark" onClick={() => setModal('note')}><Plus size={15} />패치노트 작성</button> : null}</div></div>
        {showScope && <div className="page-toolbar">{filterControls}<div className="sync-status"><span><i className="status-dot" />{lastSync === '방금' ? '방금 확인' : `${lastSync} 마지막 확인`}</span><button className={`icon-button ${syncing ? 'is-syncing' : ''}`} disabled={syncing} aria-label="데이터 새로고침" onClick={sync}><RefreshCw size={15} /></button></div></div>}
        <Routes>
          <Route path="/" element={<>
            <SectionCards unassigned={unassigned} unlinked={unlinked} reviewing={reviewing} merged={merged} period={periods[period].label} onNavigate={navigate} />
            <div className="overview-grid"><section className="team-summary"><div className="section-heading"><h2>확인이 필요한 작업</h2><NavLink to="/issues" className="subtle-link">팀 작업 보기 <ArrowUpRight size={14} /></NavLink></div><p className="section-subheading">담당자, 연결된 PR과 다음 확인 사항을 함께 살펴보세요.</p><div className="team-task-list">{[...activeIssues].sort((a, b) => Number(Boolean(a.assignee)) - Number(Boolean(b.assignee))).slice(0, 4).map(issue => <button key={issue.id} onClick={() => openIssue(issue)}><span className={`task-status task-status-${issue.status}`}><CircleDot size={16} /></span><span><strong>{issue.title}</strong><small>{repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)} · {issueAttention(issue, pullRequests)}</small></span><span className="task-assignee">{issue.assignee || '지정 필요'}</span><ChevronRight size={14} /></button>)}{!issues.some(issue => (repoFilter === 'all' || issue.repo === repoFilter) && issue.status !== 'done') && <Empty title="진행할 작업이 없어요" description="새 이슈를 만들어 다음 작업을 정리해 보세요." />}</div><button className="button full-width" onClick={() => openIssue(null)}><Plus size={14} />회의에서 할 일 등록</button></section><section className="weekly-section"><div className="section-heading"><h2>최신 팀 업데이트</h2><NavLink to="/patches" className="subtle-link">전체 보기 <ArrowUpRight size={14} /></NavLink></div>{visibleNotes.find(n => n.status === 'published') ? <PatchPreview note={visibleNotes.find(n => n.status === 'published')!} onRead={() => setNoteDetail(visibleNotes.find(n => n.status === 'published')!)} /> : <div className="patch-preview patch-empty"><Empty title="아직 공개된 패치노트가 없어요" description="반영된 PR을 선택해 패치노트를 작성하세요." action={<button className="button" onClick={() => setModal('note')}>패치노트 작성</button>} /></div>}</section></div>
            <ActivityChart activities={repoActivities} period={period} onPeriod={setPeriod} />
            <ActivityTable activities={filteredActivities} repos={repos} onSelect={setDetail} onViewAll={() => navigate('/activity')} />
            <section className="contributions-section"><div className="section-heading"><h2>팀의 활동 <span className="section-annotation">기본 브랜치 기준 · 데모 데이터</span></h2><label className="year-select"><select aria-label="활동 연도" value={year} onChange={e => setYear(e.target.value)}><option>2026</option><option>2025</option></select><ChevronDown size={12} /></label></div><ContributionSkyline data={chartData} startDate={`${year}-01-01`} endDate={year === '2026' ? '2026-10-27' : '2025-12-31'} title={<><strong className="contribution-total">{contributionTotal.toLocaleString()}</strong><span className="contribution-total-label"> contributions</span></>} defaultView="2d" palette={CHART_PALETTE} showStats={false} locale="ko-KR" unit="개 활동" unitPlural="개 활동" onCellClick={setDay} footer="날짜를 선택하면 그날의 기록을 볼 수 있어요." className="skyline" /></section>
            <section className="repos-section"><div className="section-heading"><h2>Repositories <span className="count-text">{visibleRepos.length}</span></h2><button className="subtle-link" onClick={() => setModal('repo')}><Plus size={14} />저장소 연결</button></div><div className="repo-grid">{visibleRepos.map(r => <RepoCard key={r.id} repo={r} activityCount={activities.filter(a => a.repo === r.id && inPeriod(a, period)).length} onClick={() => openRepo(r)} />)}</div></section>
          </>} />
          <Route path="/issues" element={<IssuesPanel issues={issues} repos={repos} pullRequests={pullRequests} repoFilter={repoFilter} onSelect={openIssue} onCreate={() => openIssue(null)} onSelectPr={setSelectedPr} onCreatePr={openPr} />} />
          <Route path="/pull-requests" element={<PullRequestsPanel pullRequests={pullRequests} repos={repos} issues={issues} repoFilter={repoFilter} onSelect={setSelectedPr} onSelectIssue={openIssue} />} />
          <Route path="/deployments" element={<section><div className="deployment-summary"><span className="deployment-symbol"><Rocket size={25} strokeWidth={1.4} /></span><div><h2>코드 반영과 서비스 배포를 나누어 봐요.</h2><p>빌드가 성공해도 서비스에 반영되기까지는 한 단계가 더 필요해요.</p></div></div><div className="deployment-table"><div className="deployment-table-head"><span>저장소 / 환경</span><span>빌드</span><span>서비스 배포</span><span>최근 확인</span></div>{visibleRepos.map(repo => <button className="deployment-row" key={repo.id} disabled={!activities.some(a => a.repo === repo.id)} title={activities.some(a => a.repo === repo.id) ? '관련 기록 보기' : '아직 수집된 기록이 없어요'} onClick={() => setDetail(activities.find(a => a.repo === repo.id && a.type === 'deploy') ?? activities.find(a => a.repo === repo.id) ?? null)}><span><Github size={18} /><span><strong>{repo.name}</strong><small>{repo.deployment}</small></span></span><span><Badge tone={repo.build === 'success' ? 'green' : repo.build === 'failed' ? 'red' : 'neutral'}>{repo.build === 'success' ? <CheckCircle2 size={12} /> : repo.build === 'failed' ? <CircleDot size={12} /> : <Clock3 size={12} />}{repo.build === 'success' ? '성공' : repo.build === 'failed' ? '실패' : '기록 없음'}</Badge></span><span>{repo.build === 'success' ? <Badge tone="green"><Check size={12} />배포 완료</Badge> : repo.build === 'failed' ? <Badge tone="orange"><Clock3 size={12} />배포 대기</Badge> : <Badge>확인 불가</Badge>}</span><span className="mono muted">{repo.updated}<ChevronRight size={14} /></span></button>)}</div>{visibleRepos.some(r => r.build === 'failed') && <div className="build-notice"><CircleDot size={19} /><div><strong>zello-design의 빌드를 확인해 주세요.</strong><p>공통 컴포넌트의 키보드 접근성 검사에서 실패했어요. 마지막으로 성공한 버전은 계속 제공되고 있습니다.</p><button className="text-button" onClick={() => setDetail(activities.find(a => a.id === 121)!)}>관련 작업 보기 <ArrowRight size={13} /></button></div></div>}<div className="section-heading deployment-history"><h2>최근 반영과 배포</h2><span className="muted small">선택한 기간의 기록</span></div>{filteredActivities.filter(a => a.type === 'deploy' || a.type === 'merge').map(a => <ActivityRow key={a.id} item={a} repos={repos} onSelect={setDetail} />)}{!filteredActivities.some(a => a.type === 'deploy' || a.type === 'merge') && <Empty title="반영 및 배포 기록이 없어요" description="다른 기간이나 저장소를 선택해 보세요." />}</section>} />
          <Route path="/inbox" element={<InboxPanel items={myInbox} repos={repos} onOpen={openNotification} onRead={setNotificationRead} onReadAll={readAllNotifications} />} />
          <Route path="/my-work" element={<MyWorkPanel issues={issues} pullRequests={pullRequests} repos={repos} repoFilter={repoFilter} onIssue={openIssue} onPr={setSelectedPr} />} />
          <Route path="/changes" element={<><nav className="page-subnav" aria-label="변경 소식 메뉴"><Link to="/changes?view=updates" className={changesView === 'updates' ? 'selected' : ''} aria-current={changesView === 'updates' ? 'page' : undefined}>팀 업데이트</Link><Link to="/changes?view=history" className={changesView === 'history' ? 'selected' : ''} aria-current={changesView === 'history' ? 'page' : undefined}>개발 기록</Link></nav>{changesView === 'history' ? <section className="timeline-page"><div className="content-filter"><div className="segmented-tabs">{[['all', '전체 기록'], ['merge', '반영 완료'], ['pr', '검토 중'], ['commit', '코드 변경'], ['issue', '제안'], ['deploy', '배포']].map(([value, label]) => <button key={value} className={eventFilter === value ? 'selected' : ''} aria-pressed={eventFilter === value} onClick={() => setEventFilter(value)}>{label}</button>)}</div><span className="muted small">{filteredActivities.filter(a => eventFilter === 'all' || a.type === eventFilter).length}개의 기록</span></div>{[...new Set(filteredActivities.filter(a => eventFilter === 'all' || a.type === eventFilter).map(a => a.date))].map(date => <div className="timeline-day" key={date}><div className="timeline-date"><ChevronDown size={12} /><strong>{dateLabel(date)}</strong><span>{date.replaceAll('-', '.')}</span><span className="timeline-day-count">{filteredActivities.filter(a => a.date === date && (eventFilter === 'all' || a.type === eventFilter)).length}</span></div>{filteredActivities.filter(a => a.date === date && (eventFilter === 'all' || a.type === eventFilter)).map(a => <ActivityRow key={a.id} item={a} repos={repos} onSelect={setDetail} />)}</div>)}{!filteredActivities.some(a => eventFilter === 'all' || a.type === eventFilter) && <Empty title="이 조건의 기록이 없어요" description="기간이나 활동 유형을 바꿔서 확인해 보세요." />}</section> : <section><div className="content-filter"><div className="segmented-tabs">{[['all', '전체 패치노트'], ['published', '공개됨'], ['draft', '작성 중']].map(([value, label]) => <button key={value} onClick={() => setPatchFilter(value)} className={patchFilter === value ? 'selected' : ''} aria-pressed={patchFilter === value}>{label}</button>)}</div><span className="muted small">PR 요약 기준 변경 사항</span></div><div className="notes-grid">{visibleNotes.filter(n => patchFilter === 'all' || n.status === patchFilter).map(note => <button className="note-card" key={note.id} onClick={() => setNoteDetail(note)}><div className="note-card-top"><span className="eyebrow">{note.version}</span><Badge tone={note.status === 'published' ? 'green' : 'orange'}>{note.status === 'published' ? '공개됨' : '작성 중'}</Badge></div><span className="note-card-subtitle">{note.subtitle}</span><h2>{note.title}</h2><p>{note.summary}</p><div className="note-card-bottom"><span>{note.date.replaceAll('-', '.')} <i /> {note.activityIds.length}개의 변경</span><ArrowUpRight size={20} /></div></button>)}</div>{!visibleNotes.some(n => patchFilter === 'all' || n.status === patchFilter) && <Empty title="아직 작성된 패치노트가 없습니다" description="기간을 바꾸거나 반영된 PR로 새 패치노트를 작성해 보세요." action={<button className="button" onClick={() => setModal('note')}>패치노트 작성</button>} />}</section>}</>} />
          <Route path="/activity" element={<Navigate replace to={`/changes?view=history${eventFilter === 'all' ? '' : `&type=${eventFilter}`}`} />} />
          <Route path="/patches" element={<Navigate replace to="/changes?view=updates" />} />
          <Route path="/repositories" element={<Navigate replace to="/settings?tab=repositories" />} />
          <Route path="/settings" element={<><nav className="page-subnav" aria-label="프로젝트 설정 메뉴">{[['general', '일반'], ['members', '멤버'], ['repositories', '저장소 연결'], ['sync', '동기화']].map(([tab, label]) => <Link key={tab} to={`/settings?tab=${tab}`} className={settingsTab === tab ? 'selected' : ''} aria-current={settingsTab === tab ? 'page' : undefined}>{label}</Link>)}</nav>{settingsTab === 'repositories' ? <section><div className="section-heading repo-list-heading"><h2>연결된 저장소 <span className="count-text">{repos.length}</span></h2><span className="muted small">zello-team / 프로젝트 통합 보기</span></div><div className="repo-grid repo-grid-page">{repos.map(r => <RepoCard key={r.id} repo={r} activityCount={activities.filter(a => a.repo === r.id).length} onClick={() => openRepo(r)} />)}<button className="add-repo-card" onClick={() => setModal('repo')}><Plus size={23} strokeWidth={1.3} /><strong>새로운 저장소 연결</strong><span>GitHub URL로 저장소 추가</span></button></div><div className="info-line"><Github size={16} /><p>지금은 프로토타입이에요. 추가한 저장소는 이 브라우저에 저장되며, 실제 GitHub 데이터는 수집하지 않습니다.</p></div></section> : settingsTab === 'sync' ? <section className="settings-sync"><div className="section-heading"><h2>데이터 동기화</h2><button className="button" onClick={sync} disabled={syncing}><RefreshCw size={14} className={syncing ? 'is-syncing' : ''} />{syncing ? '확인 중…' : '데모 데이터 새로고침'}</button></div><p className="section-subheading">연결한 저장소의 데이터 수집 상태를 확인하는 공간입니다.</p><div className="data-frame">{repos.map(repo => <div className="sync-repo-row" key={repo.id}><Github size={17} /><strong>{repo.name}</strong><span className="badge">{repo.build === 'unknown' ? '연동 전' : '샘플 데이터'}</span><span className="muted small">{lastSync === '방금' ? '방금 확인' : `${lastSync} 마지막 확인`}</span></div>)}</div><div className="info-line"><CircleDot size={16} /><p>현재는 데모 데이터로 동작합니다. 실제 GitHub 인증, 데이터 수집 및 자동 동기화는 아직 연결되지 않았어요.</p></div></section> : <Settings key={settingsTab} section={settingsTab === 'members' ? 'members' : 'general'} onSave={notify} />}</>} />
          <Route path="*" element={<Empty title="이 페이지를 찾지 못했어요" description="프로젝트 홈에서 팀의 기록을 이어서 확인해 주세요." action={<button className="button" onClick={() => navigate('/')}>한눈에 보기로 이동</button>} />} />
        </Routes>
        <footer className="page-footer"><span><span className="footer-brand"><GitBranch size={12} />zello</span></span><span><i className="demo-dot" /> 목데이터 프로토타입 <span className="footer-separator">/</span> 2026.10.27 기준</span></footer>
      </div>
    </SidebarInset>
    {toast && <div className="toast" role="status"><span><Check size={15} /></span>{toast}<button aria-label="알림 닫기" onClick={() => setToast('')}><X size={14} /></button></div>}
    {modal === 'issue' && <Dialog title={editingIssue ? '이슈 상세' : '새 이슈'} wide onClose={() => setModal(null)}><IssueEditor issue={editingIssue} repos={repos} pullRequests={pullRequests} defaultRepo={repoFilter} onCancel={() => setModal(null)} onViewPr={pr => { setModal(null); setSelectedPr(pr) }} onSave={values => {
      const id = editingIssue?.id ?? `ZELLO-${Math.max(0, ...issues.map(issue => Number(issue.id.split('-').at(-1)) || 0)) + 1}`
      const githubNumber = editingIssue && editingIssue.repo === values.repo ? editingIssue.githubNumber : nextRepositoryNumber(values.repo, issues, pullRequests)
      setIssues(current => editingIssue ? current.map(issue => issue.id === id ? { ...values, id, githubNumber } : issue) : [{ ...values, id, githubNumber }, ...current])
      setModal(null)
      navigate(values.status === 'done' ? '/issues?status=done' : '/issues')
      notify(editingIssue ? `${id} 이슈를 저장했어요.` : `${id} 이슈를 만들었어요.`)
    }} /></Dialog>}
    {modal === 'pr' && <Dialog title="새 Pull request" wide onClose={() => setModal(null)}><CreatePullRequest repos={repos} issues={issues} defaultRepo={repoFilter} defaultIssue={prIssue} onSubmit={createPullRequest} onCancel={() => setModal(null)} /></Dialog>}
    {selectedPr && <Dialog title="Pull request 상세" drawer onClose={() => setSelectedPr(null)}><PullRequestDetail pr={selectedPr} repos={repos} issues={issues} onViewIssue={issue => { setSelectedPr(null); openIssue(issue) }} /></Dialog>}
    {modal === 'repo' && <RepoDialog repos={repos} onClose={() => setModal(null)} onAdd={repo => { setRepos(current => [...current, repo]); setModal(null); notify(`${repo.name}을 데모 저장소로 추가했어요.`) }} />}
    {modal === 'search' && <Dialog title="프로젝트 검색" wide onClose={() => { setModal(null); setQuery('') }}><div className="search-input-wrap"><Search size={21} /><input autoFocus placeholder="화면 이동, 작업 실행, 개발 기록 검색…" value={query} onChange={e => setQuery(e.target.value)} aria-label="프로젝트 검색어" onKeyDown={e => {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          e.currentTarget.closest('[role="dialog"]')?.querySelector<HTMLButtonElement>('.command-results button')?.focus()
        }
      }} /><kbd>ESC</kbd></div><div className="search-results command-results" onKeyDown={e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('button'))
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      if (!buttons.length) return
      e.preventDefault()
      buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
    }}>
      {matchingCommands.length > 0 && <><span className="search-hint">빠른 이동 및 작업</span>{matchingCommands.map(({ label, description, icon: Icon, run }) => <button className="command-item" key={label} onClick={run}><Icon size={16} /><span>{label} <small>{description}</small></span><ArrowRight size={13} /></button>)}</>}
      {matchingIssues.length > 0 && <><span className="search-hint">이슈</span>{matchingIssues.map(issue => <button className="command-item" key={issue.id} onClick={() => { setQuery(''); openIssue(issue) }}><CircleDot size={16} /><span><small>{issue.id}</small>{issue.title}</span><ArrowRight size={13} /></button>)}</>}
      {query.trim() ? searchResults.length ? <><span className="search-hint">개발 기록</span>{searchResults.map(a => <ActivityRow key={a.id} item={a} repos={repos} onSelect={item => { setDetail(item); setModal(null); setQuery('') }} />)}</> : !matchingCommands.length && !matchingIssues.length && <Empty title="일치하는 기록이 없어요" description="다른 키워드로 검색해 보세요." /> : <><span className="search-hint">이런 기록을 찾아보세요</span><div className="search-suggestions">{['컬렉션', '공유', '김서연', '#128'].map(q => <button className="search-suggestion" key={q} onClick={() => setQuery(q)}><Search size={12} />{q}</button>)}</div></>}
    </div><div className="command-footer"><span><kbd>Tab</kbd> 이동 <kbd>↵</kbd> 선택</span><span><kbd>esc</kbd> 닫기</span></div></Dialog>}
    {modal === 'note' && <CreateNoteDialog repos={repos} onClose={() => setModal(null)} onCreate={note => { setNotes(current => [note, ...current]); setModal(null); setNoteDetail(note); notify('선택한 PR 요약으로 패치노트 초안을 만들었어요.') }} />}
    {modal === 'guide' && <Dialog title="대시보드 사용 안내" onClose={() => setModal(null)}><div className="guide-content"><h2>zello 사용 안내</h2><p>여러 저장소를 오가지 않고 회의에서 정한 작업, 담당자, PR과 변경 사항을 확인합니다.</p><ol><li><strong>저장소를 연결해요</strong><span>프론트엔드와 서버의 작업을 프로젝트 하나로 모아요.</span></li><li><strong>회의에서 작업을 등록해요</strong><span>할 일에 회의 종류, 완료 조건과 담당자를 남기고 PR을 연결해요.</span></li><li><strong>변경 내용과 다음 단계를 확인해요</strong><span>PR의 해결 이슈, 변경 요약, 검토와 병합 상태를 확인하고 패치노트로 공유해요.</span></li></ol><div className="info-line"><CircleDot size={15} /><p>zello는 작업과 PR, 변경 소식을 연결하는 협업툴입니다. 현재는 샘플 프로젝트 데이터로 동작합니다. 편집 내용은 이 브라우저에 저장돼요.</p></div><button className="button button-dark full-width" onClick={() => setModal(null)}>대시보드 확인 <ArrowRight size={15} /></button></div></Dialog>}
    {detail && <ActivityDetail activity={detail} repos={repos} onClose={() => setDetail(null)} onViewTimeline={() => { setRepoFilter(detail.repo); setDetail(null); navigate('/activity') }} />}
    {noteDetail && <NoteDetail note={notes.find(n => n.id === noteDetail.id) ?? noteDetail} repos={repos} onClose={() => setNoteDetail(null)} onSave={note => { updateNote(note); notify(note.status === 'published' ? '패치노트를 저장했어요.' : '초안을 저장했어요.') }} onCopy={notify} />}
    {day && <Dialog title="날짜별 활동" onClose={() => setDay(null)}><div className="day-detail"><span className="eyebrow">TEAM CONTRIBUTIONS</span><h2>{day.date.replaceAll('-', '.')}</h2><p>선택한 저장소의 활동 <strong>{day.count}개</strong></p>{repoActivities.filter(a => a.date === day.date).map(a => <ActivityRow key={a.id} item={a} repos={repos} onSelect={a => { setDay(null); setDetail(a) }} />)}{!repoActivities.some(a => a.date === day.date) && <div className="day-empty"><GitCommitHorizontal size={24} /><p>{day.count ? '잔디에 표시할 활동량만 준비된 날짜예요.' : '이날에는 기록된 활동이 없어요.'}</p><span>상세 목데이터는 2026년 10월 일부 날짜에 제공됩니다.</span></div>}<p className="help-text">잔디는 시각화용 샘플이며, 상세 타임라인과 별도로 생성한 데이터입니다.</p></div></Dialog>}
  </SidebarProvider>
}

function RepoDialog({ repos, onAdd, onClose }: { repos: Repo[]; onAdd: (r: Repo) => void; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    const match = url.trim().match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/)
    if (!match) { setError('https://github.com/팀이름/저장소 형식으로 입력해 주세요.'); return }
    if (repos.some(r => r.name === match[2])) { setError('같은 이름의 저장소가 이미 연결되어 있어요.'); return }
    onAdd({ id: `local-${Date.now()}`, name: match[2], description: description.trim() || `${match[1]} 팀의 새로운 저장소`, language: '미확인', color: '#a8aaa2', branch: 'main', updated: '—', build: 'unknown', deployment: '연동 전' })
  }
  return <Dialog title="프로젝트에 저장소 연결" onClose={onClose}><form className="dialog-form" onSubmit={submit}><span className="form-hero-icon"><Github size={25} /></span><h2>GitHub 저장소 추가</h2><p>프로젝트에 함께 보여줄 GitHub 저장소를 추가해요.</p><label>GitHub 저장소 URL <span className="required">*</span><input autoFocus type="url" required placeholder="https://github.com/zello-team/zello-web" value={url} onChange={e => { setUrl(e.target.value); setError('') }} aria-describedby={error ? 'repo-error' : undefined} aria-invalid={Boolean(error)} /></label><label>저장소 설명 <span className="optional">선택</span><input placeholder="팀에서 어떤 역할을 하는 저장소인가요?" value={description} onChange={e => setDescription(e.target.value)} maxLength={120} /></label>{error && <p className="form-error" id="repo-error">{error}</p>}<div className="form-info"><CircleDot size={15} /><span>프로토타입에서는 목록에만 추가돼요. 실제 GitHub에는 연결되지 않아요.</span></div><div className="form-actions"><button className="button" type="button" onClick={onClose}>취소</button><button className="button button-dark" type="submit"><Plus size={15} />저장소 추가</button></div></form></Dialog>
}
function ActivityDetail({ activity: a, repos, onClose, onViewTimeline }: { activity: Activity; repos: Repo[]; onClose: () => void; onViewTimeline: () => void }) {
  const Icon = eventIcons[a.type]
  return <Dialog title="개발 기록 상세" drawer onClose={onClose}><div className="detail-content"><span className={`event-icon large event-${a.type}`}><Icon size={24} /></span><div className="detail-kicker"><Badge tone={a.type === 'merge' ? 'purple' : a.type === 'deploy' ? 'green' : a.type === 'pr' ? 'blue' : 'neutral'}>{typeLabels[a.type]}</Badge><span className="mono muted">{a.ref}</span></div><h2>{a.title}</h2><div className="detail-author"><Avatar name={a.author} small /><strong>{a.author}</strong><span>{a.date.replaceAll('-', '.')} · {a.time}</span></div><div className="detail-summary"><span className="eyebrow">팀을 위한 요약</span><p>{a.summary}</p><span className="summary-source"><FileText size={12} />{a.type === 'deploy' ? '배포 기록' : a.type === 'issue' ? '이슈 본문' : 'PR 및 커밋에 작성된 설명'}</span></div><dl className="detail-properties"><div><dt>저장소</dt><dd><Github size={14} />{repos.find(r => r.id === a.repo)?.name}</dd></div><div><dt>작업 브랜치</dt><dd><GitBranch size={14} /><span className="mono">{a.branch}</span></dd></div><div><dt>서비스 반영</dt><dd>{a.deployed ? <span className="green-text"><CheckCircle2 size={14} />배포 완료</span> : <span><Clock3 size={14} />{a.type === 'merge' ? '배포 대기' : '아직 반영되지 않았어요'}</span>}</dd></div></dl>{a.commits > 0 && <div className="diff-summary"><div><strong>{a.commits}</strong><span>commits</span></div><div><strong>{a.files}</strong><span>변경 파일</span></div><div><span className="diff-add">+{a.additions}</span><span className="diff-delete">−{a.deletions}</span></div></div>}<div className="detail-flow"><h3>하나의 변화가 되기까지</h3><div><span className="flow-step done"><Check size={13} /></span><span>작업 기록</span><i /><span className={`flow-step ${a.type === 'merge' || a.deployed ? 'done' : ''}`}>{a.type === 'merge' || a.deployed ? <Check size={13} /> : <span>2</span>}</span><span>기본 브랜치 반영</span><i /><span className={`flow-step ${a.deployed ? 'done' : ''}`}>{a.deployed ? <Check size={13} /> : <span>3</span>}</span><span>서비스 배포</span></div></div><button className="button full-width" onClick={onViewTimeline}>이 저장소의 기록 보기 <ArrowRight size={15} /></button><p className="help-text">실제 GitHub 연결 전의 샘플 기록입니다.</p></div></Dialog>
}
function NoteDetail({ note, repos, onClose, onSave, onCopy }: { note: PatchNote; repos: Repo[]; onClose: () => void; onSave: (note: PatchNote) => void; onCopy: (message: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(note.title)
  const [summary, setSummary] = useState(note.summary)
  const changes = note.activityIds.map(id => activities.find(a => a.id === id)).filter((a): a is Activity => Boolean(a))
  async function copy() {
    const text = `${note.title}\n${note.subtitle} · ${note.version}\n\n${note.summary}\n\n${changes.map(a => `• ${a.title}\n${a.summary}`).join('\n\n')}`
    try { await navigator.clipboard.writeText(text); onCopy('패치노트 내용을 복사했어요.') } catch { onCopy('복사 권한이 없어요. 본문을 선택해서 복사해 주세요.') }
  }
  return <Dialog title="패치노트" drawer onClose={onClose}><article className="note-detail"><div className="note-detail-meta"><span className="eyebrow">{note.version} / {note.date.replaceAll('-', '.')}</span><Badge tone={note.status === 'published' ? 'green' : 'orange'}>{note.status === 'published' ? '공개됨' : '작성 중'}</Badge></div>{editing ? <form className="note-edit" onSubmit={e => { e.preventDefault(); onSave({ ...note, title: title.trim(), summary: summary.trim() }); setEditing(false) }}><label>제목<textarea required maxLength={120} value={title} onChange={e => setTitle(e.target.value)} rows={3} /></label><label>소개<textarea required value={summary} onChange={e => setSummary(e.target.value)} rows={5} maxLength={1200} /></label><div className="form-actions"><button type="button" className="button" onClick={() => { setEditing(false); setTitle(note.title); setSummary(note.summary) }}>취소</button><button className="button button-dark" type="submit">변경 사항 저장</button></div></form> : <><span className="note-detail-subtitle">{note.subtitle}</span><h2>{note.title}</h2><p className="note-detail-intro">{note.summary}</p><div className="note-detail-rule"><span />RELEASE NOTES<span /></div>{changes.map(a => <section className="note-change" key={a.id}><span className={`category-label category-label-${a.noteType}`}>{a.noteType ? categoryLabels[a.noteType] : '변경 사항'}</span><h3>{a.title}</h3><p>{a.summary}</p><div><span className="mono">{repos.find(r => r.id === a.repo)?.name} {a.ref}</span><span className={a.deployed ? 'green-text' : 'orange-text'}>{a.deployed ? <Check size={12} /> : <Clock3 size={12} />}{a.deployed ? '서비스에 반영됐어요' : '아직 배포 전이에요'}</span></div></section>)}<div className="note-author"><Avatar name="이수빈" small /><span><strong>zello 팀</strong>이 함께 만들고, 이수빈 님이 정리했어요.</span></div><div className="note-detail-actions"><button className="button" onClick={() => { setTitle(note.title); setSummary(note.summary); setEditing(true) }}><FileText size={14} />내용 편집</button><button className="button" onClick={copy}><Copy size={14} />내용 복사</button>{note.status === 'draft' && <button className="button button-dark" onClick={() => onSave({ ...note, status: 'published' })}>팀에 공개 <ArrowUpRight size={14} /></button>}</div><p className="help-text">편집과 공개 상태는 이 브라우저에만 저장됩니다.</p></>}</article></Dialog>
}
function CreateNoteDialog({ repos, onCreate, onClose }: { repos: Repo[]; onCreate: (note: PatchNote) => void; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const available = sortedActivities.filter(a => a.type === 'merge')
  return <Dialog title="새로운 패치노트" wide onClose={onClose}><form className="dialog-form create-note" onSubmit={e => { e.preventDefault(); if (!selected.length || !title.trim()) return; onCreate({ id: `local-${Date.now()}`, title: title.trim(), subtitle: '프로젝트 업데이트', date: '2026-10-27', version: '새 업데이트', status: 'draft', activityIds: selected, summary: 'PR에 작성한 요약을 모았어요. 팀에 공개하기 전에 소개와 변경 내용을 확인해 주세요.' }) }}><h2>패치노트 작성</h2><p>반영된 PR을 선택하면 작성자가 남긴 요약을 모아 초안을 만들어요.</p><label>패치노트 제목<input autoFocus required placeholder="이번 업데이트를 한 문장으로 표현해 주세요" value={title} onChange={e => setTitle(e.target.value)} maxLength={120} /></label><span className="form-label">함께 소개할 변경 사항 <span className="muted">{selected.length}개 선택</span></span><div className="pr-checklist">{available.map(a => <label key={a.id}><input type="checkbox" checked={selected.includes(a.id)} onChange={() => setSelected(current => current.includes(a.id) ? current.filter(id => id !== a.id) : [...current, a.id])} /><span><strong>{a.title}</strong><small>{repos.find(r => r.id === a.repo)?.name} · {a.ref} · {a.deployed ? '배포 완료' : '배포 대기'}</small></span></label>)}</div><div className="form-actions"><span className="help-text">LLM 없이 PR 요약으로 구성해요.</span><button type="button" className="button" onClick={onClose}>취소</button><button className="button button-dark" disabled={!selected.length || !title.trim()} type="submit">초안 만들기 <ArrowRight size={14} /></button></div></form></Dialog>
}
function Settings({ onSave, section }: { onSave: (s: string) => void; section: 'general' | 'members' }) {
  const [settings, setSettings] = useStored('gyeol.settings.v1', { description: '컬렉션 관리 및 공유 서비스', timezone: 'Asia/Seoul', interval: '15', weekly: true })
  const [form, setForm] = useState(settings)
  return <div className="settings-page settings-single">{section === 'general' && <form className="settings-form" onSubmit={e => { e.preventDefault(); setSettings(form); onSave('프로젝트 설정을 이 브라우저에 저장했어요.') }}><div className="settings-section-title"><SlidersHorizontal size={18} /><h2>프로젝트 기본 설정</h2></div><label>프로젝트 이름<input value="샘플 프로젝트" readOnly /><span className="help-text">프로토타입의 프로젝트 이름은 고정되어 있어요.</span></label><label>프로젝트 설명<input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} maxLength={120} /></label><div className="settings-columns"><label>집계 시간대<select value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}><option value="Asia/Seoul">서울 · UTC +09:00</option><option value="UTC">UTC · UTC +00:00</option></select></label><label>자동 동기화 간격<select value={form.interval} onChange={e => setForm({ ...form, interval: e.target.value })}><option value="5">5분마다</option><option value="15">15분마다</option><option value="30">30분마다</option></select></label></div><label className="checkbox-setting"><input type="checkbox" checked={form.weekly} onChange={e => setForm({ ...form, weekly: e.target.checked })} /><span><strong>주간 요약 알림</strong><small>매주 팀이 만든 변화를 모아 알려드려요.</small></span></label><div className="form-actions"><span className="help-text">설정 저장을 체험할 수 있어요. 실제 수집·알림에는 적용되지 않아요.</span><button type="submit" className="button button-dark">설정 저장</button></div></form>}{section === 'members' && <section className="settings-members"><div className="settings-section-title"><Users size={18} /><h2>함께하는 멤버</h2><span className="count-text">4</span></div>{members.map(m => <div className="member-row" key={m.name}><Avatar name={m.name} /><span><strong>{m.name}</strong><small>{m.role}</small></span><Badge>{m.name === '이수빈' ? '관리자' : '편집자'}</Badge></div>)}<p className="help-text">멤버 초대와 권한 변경은 GitHub 연동 후 제공할 예정이에요.</p></section>}</div>
}
