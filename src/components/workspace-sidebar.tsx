import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, BookOpen, Check, ChevronDown, CircleDot, CircleHelp, GitPullRequest, Layers3, LayoutDashboard, Plus, Rocket, Search, Settings, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar'

type NavigationItem = { to: string; label: string; icon: LucideIcon; count?: number; selected: boolean }
export function WorkspaceSidebar({ unreadCount, myWorkCount, issueCount, pullRequestCount, onGuide, onSearch, onCreate }: {
  unreadCount: number; myWorkCount: number; issueCount: number; pullRequestCount: number;
  onGuide: () => void; onSearch: () => void; onCreate: () => void;
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
    { to: '/', label: '전체 현황', icon: LayoutDashboard, selected: location.pathname === '/' },
    { to: '/issues', label: '팀 작업', icon: CircleDot, count: issueCount, selected: location.pathname === '/issues' },
    { to: '/pull-requests', label: '코드 검토', icon: GitPullRequest, count: pullRequestCount, selected: location.pathname === '/pull-requests' },
    { to: '/changes', label: '변경 소식', icon: BookOpen, selected: changesActive },
  ]
  const management: NavigationItem[] = [
    { to: '/deployments', label: '빌드와 배포', icon: Rocket, selected: location.pathname === '/deployments' },
    { to: '/settings', label: '프로젝트 설정', icon: Settings, selected: settingsActive },
  ]
  useEffect(() => { setOpenMobile(false); if (projectMenu.current) projectMenu.current.open = false }, [location.pathname, location.search, setOpenMobile])
  const closeMobile = (action: () => void) => { action(); setOpenMobile(false) }
  function group(label: string, items: NavigationItem[]) {
    return <SidebarGroup className="workspace-nav-group"><SidebarGroupLabel>{label}</SidebarGroupLabel><SidebarMenu>{items.map(({ to, label: title, icon: Icon, count, selected }) => <SidebarMenuItem key={to}><SidebarMenuButton asChild isActive={selected}><Link to={to} aria-current={selected ? 'page' : undefined}><Icon size={17} /><span>{title}</span>{count !== undefined && count > 0 && <span className={`nav-count ${to === '/inbox' ? 'inbox-count' : ''}`}>{count}</span>}</Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroup>
  }
  return <Sidebar variant="inset" collapsible="offcanvas" className="workspace-sidebar" aria-label="메인 메뉴"><SidebarHeader className="workspace-sidebar-header">
    <div className="sidebar-app-label"><Layers3 size={14} /><span>프로젝트 대시보드</span><span className="sidebar-demo-label">DEMO</span></div>
    <details ref={projectMenu} className="project-switch"><summary><span className="workspace-logo">M</span><span><strong>모아 프로젝트</strong><small>컬렉션 관리 및 공유 서비스</small></span><ChevronDown size={14} /></summary><div className="project-switch-menu"><span className="search-hint">현재 프로젝트</span><Link to="/" onClick={() => { if (projectMenu.current) projectMenu.current.open = false }}>모아 프로젝트<Check size={14} /></Link><Link to="/settings" onClick={() => { if (projectMenu.current) projectMenu.current.open = false }}>프로젝트 설정<Settings size={14} /></Link><small>프로젝트 1개로 구성된 데모예요.</small></div></details>
    <div className="sidebar-quick-actions"><button className="button button-dark" onClick={() => closeMobile(onCreate)}><Plus size={16} />새 작업 등록</button><button className="button sidebar-search" onClick={() => closeMobile(onSearch)} aria-label="검색 및 빠른 이동" title="검색 및 빠른 이동 · ⌘K"><Search size={16} /></button></div>
  </SidebarHeader><SidebarContent>{group('내가 확인할 것', personal)}{group('팀이 진행하는 일', project)}{group('프로젝트 관리', management)}<SidebarGroup className="workspace-nav-group sidebar-secondary"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={() => closeMobile(onGuide)}><CircleHelp size={17} /><span>도움말</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter className="workspace-sidebar-footer"><Link to="/my-work" className="profile"><span className="profile-monogram">수빈</span><span><strong>이수빈</strong><small>모아 팀 · 관리자</small></span><UserRound size={15} /></Link></SidebarFooter></Sidebar>
}
