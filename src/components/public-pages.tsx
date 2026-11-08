import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Bell, ChevronRight, CircleDot, Github, GitPullRequest, LoaderCircle, Megaphone, Moon, ShieldCheck, Sun } from 'lucide-react'
import { BrandMark } from './brand-mark'
import { Button } from './ui/button'
import { useTheme } from '../hooks/use-theme'
import { listProjects, listConnectedRepositories } from '../lib/project-api'
import { invitationReturnPath, rememberInvitation, pendingInvitation } from '../lib/auth-return'
import { beginGitHubLogin } from '../lib/session-api'
import { useSession } from '../hooks/use-session'
import { initialIssues, initialPullRequests, issueSources, issueStatuses } from '../data/work-items'
import { initialRepos } from '../data/mock'
import './public-pages.css'

function Brand() {
  return <Link to="/" className="public-brand" aria-label="zello 홈"><BrandMark />zello</Link>
}

function ThemeToggle() {
  const [theme, setTheme] = useTheme()
  return <Button variant="ghost" size="icon-sm" className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? '어두운 테마로 전환' : '밝은 테마로 전환'}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</Button>
}

function SkipLink() {
  return <a className="skip-link" href="#public-main" onClick={e => { e.preventDefault(); document.getElementById('public-main')?.focus() }}>본문으로 이동</a>
}

function Footer() {
  return <footer className="public-footer">© {new Date().getFullYear()} zello</footer>
}

function ProjectPreview() {
  const selected = initialIssues[0]
  const repo = initialRepos.find(repo => repo.id === selected.repo)
  const linkedPr = initialPullRequests.find(pr => selected.pullRequestIds.includes(pr.id))
  return <section id="sample-project-preview" className="public-project-preview" aria-label="샘플 프로젝트 미리보기" aria-describedby="sample-preview-note">
    <aside className="preview-sidebar" aria-label="미리보기 메뉴">
      <span className="preview-nav-item preview-project-name"><span>P</span>샘플 프로젝트<ChevronRight size={13} /></span>
      <span className="preview-nav-item"><Bell size={14} />알림함</span>
      <span className="preview-nav-label">프로젝트</span>
      <span className="preview-nav-item preview-nav-current"><CircleDot size={14} />팀 작업<span>{initialIssues.length}</span></span>
      <span className="preview-nav-item"><GitPullRequest size={14} />코드 검토</span>
      <span className="preview-nav-item"><Megaphone size={14} />변경 소식</span>
      <span className="preview-nav-label">저장소</span>
      {initialRepos.map(repo => <span key={repo.id} className="preview-nav-item preview-repository"><Github size={13} />{repo.name}</span>)}
      <span className="preview-demo-label">미리보기 · 샘플 데이터</span>
    </aside>
    <div className="preview-workspace">
      <div className="preview-toolbar"><span>샘플 프로젝트<ChevronRight size={12} /><strong>팀 작업</strong></span><span className="preview-only-label">화면 미리보기</span></div>
      <div className="preview-work-body">
        <div className="preview-issue-list"><div className="preview-list-heading"><h2>팀 작업</h2><span>{initialIssues.length}</span></div><div className="preview-filters" aria-label="미리보기 작업 상태">{(['all', 'in_progress', 'in_review'] as const).map(status => <span key={status} className={`preview-filter ${status === 'all' ? 'is-active' : ''}`}>{status === 'all' ? '전체' : issueStatuses[status]}</span>)}</div>
          <div className="preview-rows">{initialIssues.map(issue => <div key={issue.id} className={`preview-issue-row ${selected.id === issue.id ? 'is-selected' : ''}`}><CircleDot size={14} className={`preview-status-${issue.status}`} /><span><strong>{issue.title}</strong><small>{initialRepos.find(repo => repo.id === issue.repo)?.name} · {issue.id}</small></span><span className="preview-assignee">{issue.assignee ? issue.assignee.slice(1) : '미지정'}</span></div>)}</div>
          <p className="preview-list-note" id="sample-preview-note">화면 구성을 미리 보는 샘플이에요. 작업은 GitHub로 시작한 뒤 사용할 수 있어요.</p>
        </div>
        <section className="preview-detail" aria-label="작업 상세 미리보기"><span className="preview-detail-id mono">{selected.id}</span><h3>{selected.title}</h3><dl><div><dt>상태</dt><dd><CircleDot size={12} />{issueStatuses[selected.status]}</dd></div><div><dt>담당자</dt><dd>{selected.assignee || '미지정'}</dd></div><div><dt>저장소</dt><dd>{repo?.name}</dd></div><div><dt>등록</dt><dd>{selected.source ? issueSources[selected.source] : '수시 요청'}</dd></div></dl><p className="preview-detail-description">{selected.description}</p><div className="preview-linked-pr"><h4>관련 코드 변경</h4>{linkedPr ? <div className="preview-pr-item"><GitPullRequest size={14} /><span><strong>{linkedPr.title}</strong><small>{repo?.name} #{linkedPr.number}</small></span><ChevronRight size={12} /></div> : <p>아직 연결된 코드 변경이 없어요.</p>}</div></section>
      </div>
    </div>
  </section>
}

export function LandingPage() {
  const session = useSession()
  useEffect(() => { document.title = 'zello · 팀과 쉽게 일해요' }, [])

  return <div className="public-shell landing-page">
    <SkipLink />
    <header className="public-header"><Brand /><nav aria-label="서비스 메뉴"><ThemeToggle />{session.status === 'loading' ? <span className="public-session-label" role="status">로그인 확인 중…</span> : session.user ? <><span className="public-session-label"><span className="public-session-dot" />{session.user.displayName}님 · 로그인됨</span><Button asChild size="sm" variant="outline"><Link to="/overview">워크스페이스로 이동</Link></Button></> : <Button asChild size="sm"><Link to="/login">시작하기<ArrowRight size={13} /></Link></Button>}</nav></header>
    <main id="public-main" tabIndex={-1} className="landing-main">
      <section className="landing-intro"><div><h1>Git에 익숙하지 않아도<br />괜찮아요.</h1><p>할 일을 나누고, 어디까지 됐는지 쉽게 확인해요.<br />복잡한 GitHub 기록도 팀이 이해하기 쉽게 모아봐요.</p></div><div className="landing-actions"><Button asChild size="lg"><Link to={session.user ? '/settings?tab=repositories' : '/login'}><Github size={17} />{session.user ? '프로젝트와 저장소 연결하기' : 'GitHub로 시작하기'}</Link></Button></div></section>
      <ProjectPreview />
      <div className="landing-footnote"><p>회의에서 정한 일부터 담당자와 진행 상황까지, 한곳에서 확인해요.</p></div>
    </main><Footer />
  </div>
}

const errorMessages: Record<string, string> = {
  access_denied: 'GitHub 로그인이 취소됐어요. 다시 시도해 주세요.',
  expired: '로그인 시간이 만료됐어요. 다시 로그인해 주세요.',
  failed: 'GitHub 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
  inactive: '사용할 수 없는 계정이에요. 계정 상태를 확인해 주세요.',
}

export function AuthPage() {
  const session = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const error = new URLSearchParams(location.search).get('error')
  const reauthorize = new URLSearchParams(location.search).get('reauth') === 'github'
  const next = invitationReturnPath(new URLSearchParams(location.search).get('next')) ?? pendingInvitation()
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => {
    if (session.status === 'ready' && session.user && !error && !reauthorize) navigate(next ?? '/overview', { replace: true })
  }, [session.status, session.user, error, reauthorize, next, navigate])
  useEffect(() => {
    document.title = '시작하기 · zello'
    setNotice(error ? errorMessages[error] ?? errorMessages.failed : '')
    setPending(false)
  }, [error])
  useEffect(() => {
    const reset = () => setPending(false)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])
  async function continueWithGithub() {
    if (pending) return
    setNotice('')
    setPending(true)
    try {
      if (next) rememberInvitation(next)
      await beginGitHubLogin(import.meta.env.VITE_GITHUB_AUTH_URL)
    } catch (cause) {
      setPending(false)
      setNotice(cause instanceof Error ? cause.message : 'GitHub 로그인에 실패했어요. 다시 시도해 주세요.')
    }
  }
  return <div className="public-shell auth-page auth-unified">
    <SkipLink />
    <header className="public-header"><Brand /><nav aria-label="서비스 메뉴"><Link className="public-login-link" to="/">서비스 소개</Link><ThemeToggle /></nav></header>
    <main id="public-main" tabIndex={-1} className="auth-main">
      <section className="auth-form-content auth-welcome-card" aria-labelledby="auth-title">
        <span className="auth-welcome-mark" aria-hidden="true"><BrandMark /></span>
        <h1 id="auth-title">zello 시작하기</h1>
        <p className="auth-description">팀의 작업부터 코드 검토까지.<br />GitHub 계정으로 한곳에서 함께해요.</p>
        {reauthorize && <p className="auth-context-note">저장소 접근 권한을 갱신하려면 GitHub에 다시 연결해 주세요.</p>}
        {next && <p className="auth-context-note">로그인 후 초대받은 프로젝트로 안내해 드릴게요.</p>}
        <Button className="github-auth-button" size="lg" onClick={continueWithGithub} disabled={pending} aria-busy={pending}>
          {pending ? <LoaderCircle size={19} className="auth-spinner" /> : <Github size={19} />}<span>{pending ? 'GitHub로 이동 중' : 'GitHub로 계속하기'}</span>{!pending && <ArrowRight size={16} />}
        </Button>
        <p className="auth-account-note">처음이라면 계정이 만들어지고,<br />이미 함께하고 있다면 바로 로그인돼요.</p>
        {notice && <div className="auth-notice" role="status"><p>{notice}</p></div>}
        <details className="auth-permissions"><summary><ShieldCheck size={14} />GitHub 연결 권한 안내<ChevronRight size={13} /></summary><p>프로필·조직과 공개·비공개 저장소에 접근합니다. GitHub의 저장소 권한에는 읽기와 쓰기가 함께 포함됩니다.</p></details>
      </section>
    </main><Footer />
  </div>
}

export function AuthCallbackPage() {
  const session = useSession()
  const [returnTo] = useState(() => pendingInvitation())
  const navigate = useNavigate()
  useEffect(() => {
    if (session.status !== 'ready') return
    if (!session.user) { navigate('/login?error=expired', { replace: true }); return }
    if (returnTo) { pendingInvitation(true); navigate(returnTo, { replace: true }); return }
    const controller = new AbortController()
    void listProjects(controller.signal).then(async projects => {
      const connected = await Promise.all(projects.map(project => listConnectedRepositories(project.id, controller.signal)))
      if (!controller.signal.aborted) navigate(connected.some(items => items.length) ? '/issues' : '/onboarding', { replace: true })
    }).catch(() => { if (!controller.signal.aborted) navigate('/onboarding', { replace: true }) })
    return () => controller.abort()
  }, [session.status, session.user, navigate, returnTo])
  return <div className="public-shell auth-page"><header className="public-header"><Brand /></header>
    <main className="auth-main"><section className="auth-form-content"><h1>로그인 확인</h1>
      {session.status === 'unavailable' ? <><p className="auth-description" role="alert">{session.error}</p><Button className="github-auth-button" onClick={() => void session.refresh()}>다시 확인</Button><Link className="public-text-link" to="/login">로그인 화면으로</Link></> : <p className="auth-description" role="status"><LoaderCircle size={16} className="auth-spinner" /> 로그인 정보를 확인하고 있어요.</p>}
    </section></main><Footer /></div>
}
