import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useSession } from '../hooks/use-session'
import { RepositoryConnections } from './repository-connections'
import { listProjects } from '../lib/project-api'
import { preferredProject, rememberProjectForUser } from '../lib/workspace'
import { BrandMark } from './brand-mark'

export function Onboarding() {
  const session = useSession()
  const [error, setError] = useState('')
  const [params] = useSearchParams()
  const newProject = params.get('new') === '1'
  const [checking, setChecking] = useState(true)
  const [existing, setExisting] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!session.user) return
    if (newProject) { setChecking(false); return }
    const userId = session.user.id
    const controller = new AbortController()
    setChecking(true); setError('')
    void listProjects(controller.signal).then(items => {
      if (controller.signal.aborted) return
      const preferred = preferredProject(userId)
      const current = preferred ? items.find(item => item.id === preferred) : items[0]
      if (current) rememberProjectForUser(userId, current.id)
      setExisting(items.length > 0)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '프로젝트를 확인하지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [session.user?.id, newProject, revision])
  if (session.status === 'ready' && !session.user) return <Navigate to="/login" replace />
  if (existing && !newProject) return <Navigate to="/settings?tab=repositories" replace />
  return <main className="onboarding-page">
    <header className="section-heading"><Link className="public-brand" to="/"><BrandMark />zello</Link>{session.user && <div className="issue-actions"><span>{session.user.displayName}</span><button className="subtle-link" onClick={() => void session.logout().catch(cause => setError(cause instanceof Error ? cause.message : '로그아웃하지 못했어요.'))}>로그아웃</button></div>}</header>
    {error && <div className="connection-error" role="alert">{error}<button className="button" onClick={() => setRevision(value => value + 1)}>다시 확인</button></div>}
    <div className="onboarding-intro"><span className="eyebrow">마지막으로, 함께 작업할 공간을 연결해요</span><h1>어떤 저장소로 시작할까요?</h1><p>여러 저장소를 한꺼번에 선택하면 하나의 프로젝트로 준비돼요. 팀 저장소가 보이지 않으면 조직 접근만 한 번 승인해 주세요.</p></div>
    {session.user ? checking ? <p role="status">현재 프로젝트를 확인하고 있어요…</p> : !error && <RepositoryConnections key={newProject ? 'new' : 'first'} onboarding userId={session.user.id} /> : <p role="status">로그인 정보를 확인하고 있어요.</p>}
    <Link className="subtle-link" to="/issues">나중에 연결하기</Link>
  </main>
}
