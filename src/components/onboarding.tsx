import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSession } from '../hooks/use-session'
import { RepositoryConnections } from './repository-connections'
import { BrandMark } from './brand-mark'

export function Onboarding() {
  const session = useSession()
  const [error, setError] = useState('')
  if (session.status === 'ready' && !session.user) return <Navigate to="/login" replace />
  return <main className="onboarding-page">
    <header className="section-heading"><Link className="public-brand" to="/"><BrandMark />zello</Link>{session.user && <div className="issue-actions"><span>{session.user.displayName}</span><button className="subtle-link" onClick={() => void session.logout().catch(cause => setError(cause instanceof Error ? cause.message : '로그아웃하지 못했어요.'))}>로그아웃</button></div>}</header>
    {error && <p role="alert">{error}</p>}
    <div className="onboarding-intro"><span className="eyebrow">마지막으로, 함께 작업할 공간을 연결해요</span><h1>어떤 저장소로 시작할까요?</h1><p>여러 저장소를 한꺼번에 선택하면 하나의 프로젝트로 준비돼요. 팀 저장소가 보이지 않으면 조직 접근만 한 번 승인해 주세요.</p></div>
    {session.user ? <RepositoryConnections onboarding /> : <p role="status">로그인 정보를 확인하고 있어요.</p>}
    <Link className="subtle-link" to="/issues">나중에 연결하기</Link>
  </main>
}
