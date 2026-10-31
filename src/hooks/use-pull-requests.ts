import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fromServerPullRequest } from '../data/work-items'
import type { PullRequest } from '../data/work-items'
import { listProjects, listPullRequests, ProjectApiError, syncPullRequests } from '../lib/project-api'
import type { Project, PullRequestPage } from '../lib/project-api'

const reauthCodes = ['AUTHENTICATION_REQUIRED', 'GITHUB_REAUTH_REQUIRED', 'ACCOUNT_INACTIVE']

/**
 * 로그인했고 프로젝트가 있으면 서버(DB)의 실제 PR을 쓴다. 프로젝트가 없으면 active=false라서 화면은 샘플 데이터를 유지한다.
 * 코드 검토·내 작업 화면에 들어올 때마다 다시 불러온다. GitHub에서 새로 가져오는 것은 sync()뿐이다.
 */
export function useLivePullRequests(enabled: boolean, pathname: string) {
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
      const current = projects[0] ?? null
      if (pending.signal.aborted) return
      projectId.current = current?.id ?? null
      setProject(current)
      if (!current) { setAll(null); setMine(null); setRequested(null); setError(''); return }
      const [everything, authored, reviewing] = await Promise.all([
        listPullRequests(current.id, { state: 'all' }, pending.signal),
        listPullRequests(current.id, { state: 'open', author: 'me' }, pending.signal),
        listPullRequests(current.id, { state: 'open', reviewer: 'me' }, pending.signal),
      ])
      if (pending.signal.aborted) return
      setAll(everything); setMine(authored); setRequested(reviewing); setError(''); setReauth(false); setLoadedAt(new Date())
    } catch (cause) {
      if (pending.signal.aborted) return
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
      setProject(null); setAll(null); setMine(null); setRequested(null); setError(''); setLoading(false)
      return
    }
    void load()
    return () => controller.current?.abort()
  }, [enabled, load, refreshKey])

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
    active: enabled && project !== null, project, pullRequests, authored, reviews, reviewCount: requested?.counts.open ?? 0, loading, error, reauth, loadedAt, sync, reload: load,
    openCount: all?.counts.open ?? 0, authoredCount: mine?.counts.open ?? 0, hasMore: Boolean(all?.hasNext),
  }
}
