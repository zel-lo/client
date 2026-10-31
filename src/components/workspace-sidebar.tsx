import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, BookOpen, Check, ChevronDown, CircleDot, CircleHelp, GitPullRequest, LayoutDashboard, Plus, Rocket, Search, Settings, UserRound } from 'lucide-react'
import { BrandMark } from './brand-mark'
import type { LucideIcon } from 'lucide-react'
import type { Project } from '../lib/project-api'
import type { CurrentUser } from '../lib/session-api'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'

type NavigationItem = { to: string; label: string; icon: LucideIcon; count?: number; selected: boolean }
export function WorkspaceSidebar({ unreadCount, myWorkCount, issueCount, pullRequestCount, onGuide, onSearch, onCreate, currentUser, onLogout, currentProjectName, currentProjectId, projects = [], projectLoading = false, onSelectProject, logoutPending = false }: {
  unreadCount: number; myWorkCount: number; issueCount: number; pullRequestCount: number;
  onGuide: () => void; onSearch: () => void; onCreate: () => void;
  currentProjectId?: string; projects?: Project[]; projectLoading?: boolean; onSelectProject?: (id: string) => void;
  currentProjectName?: string; currentUser?: CurrentUser | null; onLogout?: () => void; logoutPending?: boolean;
}) {
  const location = useLocation()
  const projectMenu = useRef<HTMLDetailsElement>(null)
  const { setOpenMobile } = useSidebar()
  const changesActive = ['/changes', '/activity', '/patches'].includes(location.pathname)
  const settingsActive = ['/settings', '/repositories'].includes(location.pathname)
  const personal: NavigationItem[] = [
    { to: '/inbox', label: '알림함', icon: Bell, count: unreadCount, selected: location.pathname === '/inbox' },
    { to: '/my-work', label: '내 작업', icon: UserRound, count: myWorkCount, selected: location.pathname === '/my-work' },
  ]
  const project: NavigationItem[] = [
    { to: '/overview', label: '전체 현황', icon: LayoutDashboard, selected: location.pathname === '/overview' },
    { to: '/issues', label: '팀 작업', icon: CircleDot, count: issueCount, selected: location.pathname === '/issues' },
    { to: '/pull-requests', label: '코드 검토', icon: GitPullRequest, count: pullRequestCount, selected: location.pathname === '/pull-requests' },
    { to: '/changes', label: '변경 소식', icon: BookOpen, selected: changesActive },
  ]
  const management: NavigationItem[] = [
    { to: '/deployments', label: '빌드와 배포', icon: Rocket, selected: location.pathname === '/deployments' },
    { to: '/settings', label: '프로젝트 설정', icon: Settings, selected: settingsActive },
  ]
  useEffect(() => { setOpenMobile(false); if (projectMenu.current) projectMenu.current.open = false }, [location.pathname, location.search, setOpenMobile])
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (projectMenu.current && !projectMenu.current.contains(event.target as Node)) projectMenu.current.open = false }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && projectMenu.current?.open) { projectMenu.current.open = false; projectMenu.current.querySelector('summary')?.focus() } }
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [])
  const closeMobile = (action: () => void) => { action(); setOpenMobile(false) }
  function group(label: string, items: NavigationItem[]) {
    return <SidebarGroup className="workspace-nav-group"><SidebarGroupLabel>{label}</SidebarGroupLabel><SidebarMenu>{items.map(({ to, label: title, icon: Icon, count, selected }) => <SidebarMenuItem key={to}><SidebarMenuButton asChild isActive={selected}><Link to={to} aria-current={selected ? 'page' : undefined}><Icon size={17} /><span>{title}</span>{count !== undefined && count > 0 && <span className={`nav-count ${to === '/inbox' ? 'inbox-count' : ''}`}>{count}</span>}</Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup>
  }
  return <Sidebar variant="inset" collapsible="offcanvas" className="workspace-sidebar" aria-label="메인 메뉴"><SidebarHeader className="workspace-sidebar-header">
    <Link to="/" className="sidebar-app-label" aria-label="zello 홈"><BrandMark /><span>zello</span></Link>
    <details ref={projectMenu} className="project-switch"><summary aria-label="프로젝트 전환"><span className="workspace-logo">{currentProjectName?.slice(0, 1) ?? 'P'}</span><span><strong>{currentUser ? currentProjectName ?? (projectLoading ? '프로젝트 확인 중…' : '프로젝트 선택') : '샘플 프로젝트'}</strong><small>{currentUser ? '이 프로젝트에서 함께 작업해요' : '협업 기능을 살펴보는 샘플 공간'}</small></span><ChevronDown size={14} /></summary>
      <div className="project-switch-menu"><span className="search-hint">{currentUser ? '참여 중인 프로젝트' : '현재 프로젝트'}</span>
        {currentUser ? <div className="project-switch-options" role="group" aria-label="참여 중인 프로젝트">{projects.map(item => <button key={item.id} type="button" aria-label={`${item.name} 프로젝트로 전환`} aria-pressed={item.id === currentProjectId} disabled={projectLoading || item.id === currentProjectId} onClick={() => { onSelectProject?.(item.id); if (projectMenu.current) projectMenu.current.open = false; setOpenMobile(false) }}><span>{item.name}</span>{item.id === currentProjectId && <Check size={14} />}</button>)}{!projects.length && <p className="help-text">{projectLoading ? '프로젝트를 확인하고 있어요…' : '참여한 프로젝트가 없어요.'}</p>}</div> : <Link to="/overview">샘플 프로젝트<Check size={14} /></Link>}
        <Link to="/settings">프로젝트 설정<Settings size={14} /></Link>
        {currentUser && <Link to="/onboarding?new=1">새 프로젝트 만들기<Plus size={14} /></Link>}
        <small>{currentUser ? '프로젝트를 바꾸면 모든 메뉴가 함께 전환돼요.' : '프로젝트 1개로 구성된 데모예요.'}</small>
      </div>
    </details>
    <div className="sidebar-quick-actions"><button className="button button-dark" onClick={() => closeMobile(onCreate)}><Plus size={16} />새 작업 등록</button><button className="button sidebar-search" onClick={() => closeMobile(onSearch)} aria-label="검색 및 빠른 이동" title="검색 및 빠른 이동 · ⌘K"><Search size={16} /></button></div>
  </SidebarHeader><SidebarContent>{group('내가 확인할 것', personal)}{group('팀이 진행하는 일', project)}{group('프로젝트 관리', management)}<SidebarGroup className="workspace-nav-group sidebar-secondary"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={() => closeMobile(onGuide)}><CircleHelp size={17} /><span>도움말</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter className="workspace-sidebar-footer"><Link to={currentUser ? "/my-work" : "/login"} className="profile"><span className="profile-monogram">{currentUser ? currentUser.displayName.slice(0, 2) : '샘플'}</span><span><strong>{currentUser?.displayName ?? '샘플 방문자'}</strong><small>{currentUser ? `@${currentUser.login} · GitHub 로그인됨` : '로그인하여 내 프로젝트 연결'}</small></span><UserRound size={15} /></Link>{currentUser && <button type="button" className="session-logout" onClick={onLogout} disabled={logoutPending}>{logoutPending ? '로그아웃 중…' : '로그아웃'}</button>}{!currentUser && <Link className="session-logout" to="/login">GitHub 로그인</Link>}</SidebarFooter></Sidebar>
}
