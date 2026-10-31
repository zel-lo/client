import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { preferredProject, selectProjectForUser } from '../lib/workspace'
import { fromServerPullRequest } from '../data/work-items'
import type { PullRequest } from '../data/work-items'
import { listProjects, listPullRequests, ProjectApiError, syncPullRequests } from '../lib/project-api'
import type { Project, PullRequestPage } from '../lib/project-api'

const reauthCodes = ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE']

/**
 * 로그인했고 프로젝트가 있으면 서버(DB)의 실제 PR을 쓴다. 프로젝트가 없으면 active=false이며 로그인 회원에게는 연결을 안내한다.
 * 코드 검토·내 작업 화면에 들어올 때마다 다시 불러온다. GitHub에서 새로 가져오는 것은 sync()뿐이다.
 */
export function useLivePullRequests(enabled: boolean, pathname: string, userId?: string) {
  const [projects, setProjects] = useState<Project[]>([])
  const preferred = useRef<string | null>(preferredProject(userId))
  const [project, setProject] = useState<Project | null>(null)
  const [all, setAll] = useState<PullRequestPage | null>(null)
  const [mine, setMine] = useState<PullRequestPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reauth, setReauth] = useState(false)
  const [loadedAt, setLoadedAt] = useState<Date | null>(null)
  const controller = useRef<AbortController | null>(null)
  const projectId = useRef<string | null>(null)

  const load = useCallback(async () => {
    controller.current?.abort()
    const pending = new AbortController()
    controller.current = pending
    setLoading(true)
    try {
      const projects = await listProjects(pending.signal)
      const current = projects.find(item => item.id === preferred.current) ?? projects[0] ?? null
      if (pending.signal.aborted) return
      setProjects(projects)
      if (projectId.current !== current?.id) { setAll(null); setMine(null); setLoadedAt(null) }
      projectId.current = current?.id ?? null
      setProject(current)
      if (!current) { setAll(null); setMine(null); setError(''); return }
      const [everything, authored] = await Promise.all([
        listPullRequests(current.id, { state: 'all' }, pending.signal),
        listPullRequests(current.id, { state: 'open', author: 'me' }, pending.signal),
      ])
      if (pending.signal.aborted) return
      setAll(everything); setMine(authored); setError(''); setReauth(false); setLoadedAt(new Date())
    } catch (cause) {
      if (pending.signal.aborted) return
      setAll(null); setMine(null); setLoadedAt(null)
      if (cause instanceof ProjectApiError && ['PROJECT_NOT_FOUND', ...reauthCodes].includes(cause.code)) {
        setProject(null); projectId.current = null
      }
      setError(cause instanceof Error ? cause.message : 'PR을 불러오지 못했어요.')
      setReauth(cause instanceof ProjectApiError && reauthCodes.includes(cause.code))
    } finally {
      if (!pending.signal.aborted) setLoading(false)
    }
  }, [])

  // 두 화면에 들어올 때만 다시 불러오고, 다른 화면 사이 이동에는 다시 불러오지 않는다.
  const refreshKey = pathname === '/pull-requests' || pathname === '/my-work' ? pathname : ''
  useEffect(() => {
    if (!enabled) {
      controller.current?.abort()
      setProjects([]); setProject(null); setAll(null); setMine(null); setError(''); setLoading(false); projectId.current = null
      return
    }
    preferred.current = preferredProject(userId)
    void load()
    return () => controller.current?.abort()
  }, [enabled, load, refreshKey, userId])

  useEffect(() => {
    if (!enabled) return
    let last = 0
    const refresh = (event: Event) => {
      const selected = (event as CustomEvent<{ projectId?: string }>).detail?.projectId
      if (selected) preferred.current = selected
      if (event.type === 'focus' && Date.now() - last < 1500) return
      last = Date.now()
      void load()
    }
    window.addEventListener('zello:projects-changed', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('zello:projects-changed', refresh); window.removeEventListener('focus', refresh) }
  }, [enabled, load])

  const sync = useCallback(async () => {
    if (!projectId.current) throw new Error('먼저 프로젝트를 만들고 저장소를 연결해 주세요.')
    const result = await syncPullRequests(projectId.current)
    await load()
    return result
  }, [load])

  const pullRequests = useMemo<PullRequest[]>(() => all?.items.map(item => fromServerPullRequest(item, project?.id)) ?? [], [all, project])
  const authored = useMemo<PullRequest[]>(() => mine?.items.map(item => fromServerPullRequest(item, project?.id)) ?? [], [mine, project])
  return {
    active: enabled && project !== null, project, projects, selectProject: (id: string) => { preferred.current = id; if (userId) selectProjectForUser(userId, id); else void load() }, pullRequests, authored, loading, error, reauth, loadedAt, sync, reload: load,
    openCount: all?.counts.open ?? 0, authoredCount: mine?.counts.open ?? 0, hasMore: Boolean(all?.hasNext),
  }
}
