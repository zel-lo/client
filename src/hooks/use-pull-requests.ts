import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { preferredProject, rememberProjectForUser, selectProjectForUser } from '../lib/workspace'
import { fromServerPullRequest } from '../data/work-items'
import type { PullRequest } from '../data/work-items'
import { listProjects, listPullRequests, ProjectApiError, syncPullRequests } from '../lib/project-api'
import type { Project, PullRequestPage, PullRequestQuery } from '../lib/project-api'

const reauthCodes = ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE']
export const PULL_REQUEST_PAGE_SIZE = 30

/** 코드 검토 화면 주소(?status=&focus=&page=)를 서버 목록 조건으로 바꾼다. 이슈 미연결 필터는 아직 화면에서만 거른다. */
export function codeReviewQuery(search: string): PullRequestQuery {
  const params = new URLSearchParams(search)
  const status = params.get('status')
  const focus = params.get('focus')
  const page = Number(params.get('page'))
  return {
    state: status === 'merged' || status === 'all' ? status : 'open',
    review: focus === 'pending' ? 'pending' : focus === 'failing' ? 'changes_requested' : undefined,
    page: Number.isInteger(page) && page > 1 ? page : 1, size: PULL_REQUEST_PAGE_SIZE,
  }
}

/**
 * 로그인했고 프로젝트가 있으면 서버(DB)의 실제 PR을 쓴다. 프로젝트가 없으면 active=false이며 로그인 회원에게는 연결을 안내한다.
 * 코드 검토·내 작업 화면에 들어올 때마다 다시 불러온다. GitHub에서 새로 가져오는 것은 sync()뿐이다.
 */
export function useLivePullRequests(enabled: boolean, pathname: string, userId?: string, search = '') {
  const listKey = pathname === '/pull-requests' ? JSON.stringify(codeReviewQuery(search)) : ''
  const listQuery = useRef<PullRequestQuery>(codeReviewQuery(''))
  listQuery.current = pathname === '/pull-requests' ? codeReviewQuery(search) : { state: 'all', size: PULL_REQUEST_PAGE_SIZE }
  const [projects, setProjects] = useState<Project[]>([])
  const preferred = useRef<string | null>(preferredProject(userId))
  const [project, setProject] = useState<Project | null>(null)
  const [all, setAll] = useState<PullRequestPage | null>(null)
  const [mine, setMine] = useState<PullRequestPage | null>(null)
  const [requested, setRequested] = useState<PullRequestPage | null>(null)
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
      const current = preferred.current ? projects.find(item => item.id === preferred.current) ?? null : projects[0] ?? null
      if (pending.signal.aborted) return
      setProjects(projects)
      if (current) { preferred.current = current.id; if (userId) rememberProjectForUser(userId, current.id) }
      if (projectId.current !== current?.id) { setAll(null); setMine(null); setRequested(null); setLoadedAt(null) }
      projectId.current = current?.id ?? null
      setProject(current)
      if (!current) { setAll(null); setMine(null); setRequested(null); setError(''); return }
      const [everything, authored, reviewing] = await Promise.all([
        listPullRequests(current.id, listQuery.current, pending.signal),
        listPullRequests(current.id, { state: 'open', author: 'me' }, pending.signal),
        listPullRequests(current.id, { state: 'open', reviewer: 'me' }, pending.signal),
      ])
      if (pending.signal.aborted) return
      setAll(everything); setMine(authored); setRequested(reviewing); setError(''); setReauth(false); setLoadedAt(new Date())
    } catch (cause) {
      if (pending.signal.aborted) return
      setAll(null); setMine(null); setRequested(null); setLoadedAt(null)
      if (cause instanceof ProjectApiError && ['PROJECT_NOT_FOUND', ...reauthCodes].includes(cause.code)) {
        setProject(null); projectId.current = null
      }
      setError(cause instanceof Error ? cause.message : 'PR을 불러오지 못했어요.')
      setReauth(cause instanceof ProjectApiError && reauthCodes.includes(cause.code))
    } finally {
      if (!pending.signal.aborted) setLoading(false)
    }
  }, [userId])

  // 두 화면에 들어올 때와 코드 검토의 탭·필터·페이지가 바뀔 때만 다시 불러온다.
  const refreshKey = pathname === '/pull-requests' || pathname === '/my-work' ? pathname + listKey : ''
  useEffect(() => {
    if (!enabled) {
      controller.current?.abort()
      setProjects([]); setProject(null); setAll(null); setMine(null); setRequested(null); setError(''); setLoading(false); projectId.current = null
      return
    }
    preferred.current = preferredProject(userId)
    void load()
    return () => controller.current?.abort()
  }, [enabled, load, refreshKey, userId])

  useEffect(() => {
    if (!enabled) return
    const refresh = (event: Event) => {
      const selected = (event as CustomEvent<{ projectId?: string }>).detail?.projectId
      if (selected) preferred.current = selected
      void load()
    }
    window.addEventListener('zello:projects-changed', refresh)
    return () => { window.removeEventListener('zello:projects-changed', refresh) }
  }, [enabled, load])

  const sync = useCallback(async () => {
    if (!projectId.current) throw new Error('먼저 프로젝트를 만들고 저장소를 연결해 주세요.')
    const result = await syncPullRequests(projectId.current)
    await load()
    return result
  }, [load])

  const pullRequests = useMemo<PullRequest[]>(() => all?.items.map(item => fromServerPullRequest(item, project?.id)) ?? [], [all, project])
  const authored = useMemo<PullRequest[]>(() => mine?.items.map(item => fromServerPullRequest(item, project?.id)) ?? [], [mine, project])
  const reviews = useMemo<PullRequest[]>(() => requested?.items.map(item => fromServerPullRequest(item, project?.id)) ?? [], [requested, project])
  return {
    active: enabled && project !== null, project, projects, selectProject: (id: string) => {
      if (!projects.some(item => item.id === id) || projectId.current === id) return
      controller.current?.abort(); preferred.current = id; projectId.current = null
      setProject(null); setAll(null); setMine(null); setRequested(null); setLoadedAt(null); setLoading(true)
      if (userId) selectProjectForUser(userId, id); else void load()
    }, pullRequests, authored, reviews, reviewCount: requested?.counts.open ?? 0, loading: loading && !all, error, reauth, loadedAt, sync, reload: load,
    openCount: all?.counts.open ?? 0, authoredCount: mine?.counts.open ?? 0,
    paging: all ? { page: all.page, hasNext: all.hasNext, total: all.total, counts: { open: all.counts.open, merged: all.counts.merged, all: all.counts.open + all.counts.merged + all.counts.closed } } : null,
  }
}
