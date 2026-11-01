import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Github, ShieldCheck, Users } from 'lucide-react'
import { useSession } from '../hooks/use-session'
import { BrandMark } from './brand-mark'
import { acceptInvitation, previewInvitation, roleLabels, memberDate } from '../lib/members-api'
import type { InvitationPreview } from '../lib/members-api'
import { invitationReturnPath, pendingInvitation } from '../lib/auth-return'
import { selectProjectForUser } from '../lib/workspace'
import { useTheme } from '../hooks/use-theme'

const unavailable = { EXPIRED: '초대 링크가 만료됐어요.', REVOKED: '취소된 초대 링크예요.', ACCEPTED: '이미 사용한 초대 링크예요.', PENDING: '' }
export function InvitationPage() {
  useTheme()
  const { token = '' } = useParams()
  const session = useSession()
  const navigate = useNavigate()
  const path = invitationReturnPath(`/invite/${token}`)
  const [preview, setPreview] = useState<InvitationPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    document.title = '프로젝트 초대 · zello'
    setPreview(null); setError('')
    if (!session.user || !path) return
    const controller = new AbortController()
    setLoading(true)
    void previewInvitation(token, controller.signal).then(item => { if (!controller.signal.aborted) setPreview(item) })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '초대를 확인하지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [session.user?.id, token, path, retry])

  function enter(projectId: string) {
    if (!session.user) return
    pendingInvitation(true)
    selectProjectForUser(session.user.id, projectId)
    navigate('/issues', { replace: true })
  }
  async function accept() {
    if (busy || !preview?.canAccept) return
    setBusy(true); setError('')
    try { const result = await acceptInvitation(token); enter(result.project.id) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '프로젝트에 참여하지 못했어요.') }
    finally { setBusy(false) }
  }

  return <main className="invitation-page"><Link className="public-brand" to="/"><BrandMark />zello</Link>
    <section className="invitation-card" aria-labelledby="invite-heading"><span className="invitation-icon"><Users size={28} /></span>
      <h1 id="invite-heading">{preview ? `${preview.projectName}에 초대받았어요` : '프로젝트 초대'}</h1>
      {!path ? <p role="alert">올바르지 않은 초대 링크예요. 초대한 사람에게 링크를 다시 요청해 주세요.</p>
        : session.status === 'loading' || loading ? <p role="status">초대를 확인하고 있어요…</p>
          : session.status === 'unavailable' ? <><p role="alert">{session.error}</p><button className="button" onClick={() => void session.refresh()}>로그인 상태 다시 확인</button></>
            : !session.user ? <><p>GitHub 계정으로 로그인하면 초대한 프로젝트와 참여 권한을 확인할 수 있어요.</p><Link className="button button-dark" to={`/login?${new URLSearchParams({ next: path })}`}><Github size={16} />로그인하고 초대 확인</Link></>
              : preview ? <><p><strong>@{preview.invitedBy}</strong> 님이 함께 작업할 공간에 초대했어요.</p><div className="invitation-role"><ShieldCheck size={18} /><strong>{roleLabels[preview.role]}</strong> 권한으로 참여</div><p className="muted small">{memberDate(preview.expiresAt)}까지 사용할 수 있는 한 번의 초대예요.</p>
                {preview.alreadyMember ? <><p>이미 참여한 프로젝트예요. 기존 권한으로 이동합니다.</p><button className="button button-dark" onClick={() => enter(preview.projectId)}>프로젝트로 이동<ArrowRight size={15} /></button></>
                  : preview.canAccept ? <button className="button button-dark" disabled={busy} onClick={() => void accept()}>{busy ? '참여하는 중…' : '프로젝트 참여하기'}<ArrowRight size={15} /></button>
                    : <p className="connection-error" role="status">{unavailable[preview.status]} 초대한 사람에게 새 링크를 요청해 주세요.</p>}
                <p className="help-text">zello 프로젝트 참여 권한이며, GitHub 저장소 접근 권한은 별도로 확인합니다.</p></> : null}
      {error && <div className="connection-error" role="alert"><p>{error}</p><button className="button" disabled={busy} onClick={() => setRetry(value => value + 1)}>초대 다시 확인</button></div>}
      <Link className="subtle-link" to="/" onClick={() => pendingInvitation(true)}>홈으로 돌아가기</Link>
    </section>
  </main>
}
