import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Bell, BookOpen, ChevronRight, CircleDot, Github, GitPullRequest, LoaderCircle, Moon, Sun } from 'lucide-react'
import { BrandMark } from './brand-mark'
import { Button } from './ui/button'
import { useTheme } from '../hooks/use-theme'
import { beginGitHubLogin } from '../lib/session-api'
import { useSession } from '../hooks/use-session'
import { initialIssues, initialPullRequests, issueSources, issueStatuses } from '../data/work-items'
import type { IssueStatus } from '../data/work-items'
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
  const [filter, setFilter] = useState<IssueStatus | 'all'>('all')
  const [selected, setSelected] = useState(initialIssues[0])
  const issues = initialIssues.filter(issue => filter === 'all' || issue.status === filter)
  const repo = initialRepos.find(repo => repo.id === selected.repo)
  const linkedPr = initialPullRequests.find(pr => selected.pullRequestIds.includes(pr.id))

  function selectFilter(next: IssueStatus | 'all') {
    setFilter(next)
    const first = initialIssues.find(issue => next === 'all' || issue.status === next)
    if (first && next !== 'all' && selected.status !== next) setSelected(first)
  }

  return <section className="public-project-preview" aria-label="샘플 프로젝트 미리보기">
    <aside className="preview-sidebar" aria-label="미리보기 메뉴">
      <Link to="/overview" className="preview-project-name"><span>P</span>샘플 프로젝트<ChevronRight size={13} /></Link>
      <Link to="/inbox"><Bell size={14} />알림함</Link>
      <span className="preview-nav-label">프로젝트</span>
      <Link to="/issues" className="preview-nav-current"><CircleDot size={14} />팀 작업<span>{initialIssues.length}</span></Link>
      <Link to="/pull-requests"><GitPullRequest size={14} />코드 검토</Link>
      <Link to="/changes"><BookOpen size={14} />변경 소식</Link>
      <span className="preview-nav-label">저장소</span>
      {initialRepos.map(repo => <Link key={repo.id} to="/settings?tab=repositories" className="preview-repository"><Github size={13} />{repo.name}</Link>)}
      <span className="preview-demo-label">미리보기 · 샘플 데이터</span>
    </aside>
    <div className="preview-workspace">
      <div className="preview-toolbar"><span>샘플 프로젝트<ChevronRight size={12} /><strong>팀 작업</strong></span><Link to="/issues">팀 작업 열기<ArrowRight size={13} /></Link></div>
      <div className="preview-work-body">
        <div className="preview-issue-list"><div className="preview-list-heading"><h2>팀 작업</h2><span>{initialIssues.length}</span></div><div className="preview-filters" role="group" aria-label="미리보기 작업 상태">{(['all', 'in_progress', 'in_review'] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => selectFilter(status)}>{status === 'all' ? '전체' : issueStatuses[status]}</button>)}</div>
          <div className="preview-rows">{issues.map(issue => <button key={issue.id} className={`preview-issue-row ${selected.id === issue.id ? 'is-selected' : ''}`} onClick={() => setSelected(issue)} aria-pressed={selected.id === issue.id}><CircleDot size={14} className={`preview-status-${issue.status}`} /><span><strong>{issue.title}</strong><small>{initialRepos.find(repo => repo.id === issue.repo)?.name} · {issue.id}</small></span><span className="preview-assignee">{issue.assignee ? issue.assignee.slice(1) : '미지정'}</span></button>)}</div>
          <p className="preview-list-note">작업을 누르면 담당자와 진행 상황을 볼 수 있어요.</p>
        </div>
        <section className="preview-detail" aria-label="선택한 작업"><span className="preview-detail-id mono">{selected.id}</span><h3>{selected.title}</h3><dl><div><dt>상태</dt><dd><CircleDot size={12} />{issueStatuses[selected.status]}</dd></div><div><dt>담당자</dt><dd>{selected.assignee || '미지정'}</dd></div><div><dt>저장소</dt><dd>{repo?.name}</dd></div><div><dt>등록</dt><dd>{selected.source ? issueSources[selected.source] : '수시 요청'}</dd></div></dl><p className="preview-detail-description">{selected.description}</p><div className="preview-linked-pr"><h4>관련 코드 변경</h4>{linkedPr ? <Link to="/pull-requests"><GitPullRequest size={14} /><span><strong>{linkedPr.title}</strong><small>{repo?.name} #{linkedPr.number}</small></span><ChevronRight size={12} /></Link> : <p>아직 연결된 코드 변경이 없어요.</p>}</div></section>
      </div>
    </div>
  </section>
}

export function LandingPage() {
  useEffect(() => { document.title = 'zello · 팀과 쉽게 일해요' }, [])
  return <div className="public-shell landing-page">
    <SkipLink />
    <header className="public-header"><Brand /><nav aria-label="서비스 메뉴"><ThemeToggle /><Link to="/login" className="public-login-link">로그인</Link><Button asChild size="sm" variant="outline"><Link to="/signup">회원가입</Link></Button></nav></header>
    <main id="public-main" tabIndex={-1} className="landing-main">
      <section className="landing-intro"><div><h1>Git에 익숙하지 않아도<br />괜찮아요.</h1><p>할 일을 나누고, 어디까지 됐는지 쉽게 확인해요.<br />복잡한 GitHub 기록도 팀이 이해하기 쉽게 모아봐요.</p></div><div className="landing-actions"><Button asChild size="lg"><Link to="/signup"><Github size={17} />GitHub로 시작하기</Link></Button><Link className="public-text-link" to="/overview">샘플 프로젝트 둘러보기<ArrowRight size={14} /></Link></div></section>
      <ProjectPreview />
      <div className="landing-footnote"><p>회의에서 정한 일부터 담당자와 진행 상황까지, 한곳에서 확인해요.</p><Link to="/changes">무엇이 달라졌는지도 함께 살펴봐요<ArrowRight size={13} /></Link></div>
    </main><Footer />
  </div>
}

const errorMessages: Record<string, string> = {
  access_denied: 'GitHub 로그인이 취소됐어요. 다시 시도해 주세요.',
  expired: '로그인 시간이 만료됐어요. 다시 로그인해 주세요.',
  failed: 'GitHub 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.',
  inactive: '사용할 수 없는 계정이에요. 계정 상태를 확인해 주세요.',
}

export function AuthPage({ signup = false }: { signup?: boolean }) {
  const location = useLocation()
  const error = new URLSearchParams(location.search).get('error')
  const [notice, setNotice] = useState('')
  const [pending, setPending] = useState(false)
  useEffect(() => {
    document.title = `${signup ? '회원가입' : '로그인'} · zello`
    setNotice(error ? errorMessages[error] ?? errorMessages.failed : '')
    setPending(false)
  }, [signup, error])
  useEffect(() => {
    const reset = () => setPending(false)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])
  async function continueWithGithub() {
    setNotice('')
    setPending(true)
    try {
      await beginGitHubLogin(import.meta.env.VITE_GITHUB_AUTH_URL)
    } catch (cause) {
      setPending(false)
      setNotice(cause instanceof Error ? cause.message : 'GitHub 로그인에 실패했어요. 다시 시도해 주세요.')
    }
  }
  return <div className="public-shell auth-page">
    <SkipLink />
    <header className="public-header"><Brand /><nav aria-label="서비스 메뉴"><ThemeToggle /><Link className="public-login-link" to={signup ? '/login' : '/signup'}>{signup ? '로그인' : '회원가입'}</Link></nav></header>
    <main id="public-main" tabIndex={-1} className="auth-main"><section className="auth-form-content" aria-labelledby="auth-title"><h1 id="auth-title">{signup ? 'zello 시작하기' : 'zello에 로그인'}</h1><p className="auth-description">{signup ? 'GitHub 계정 하나로 팀과 함께 일해요.' : '함께하던 작업을 이어서 확인해요.'}</p><Button className="github-auth-button" size="lg" onClick={continueWithGithub} disabled={pending} aria-busy={pending}>{pending ? <LoaderCircle size={18} className="auth-spinner" /> : <Github size={18} />}<span>{pending ? 'GitHub로 이동 중' : signup ? 'GitHub로 시작하기' : 'GitHub로 로그인'}</span></Button>
      <p className="auth-account-note">{signup ? '처음 로그인하면 계정이 만들어져요.' : '가입할 때 사용한 GitHub 계정으로 로그인해요.'}</p>
      {notice && <div className="auth-notice" role="status"><p>{notice}</p></div>}
      <div className="auth-switch-account"><span>{signup ? '이미 계정이 있나요?' : '계정이 없나요?'}</span><Link to={signup ? '/login' : '/signup'}>{signup ? '로그인' : '회원가입'}</Link></div>
      <div className="auth-preview"><Link className="public-text-link" to="/overview">샘플 프로젝트 둘러보기<ArrowRight size={14} /></Link><p>저장소 연결은 가입 후 선택하면 돼요.</p></div>
    </section></main><Footer />
  </div>
}

export function AuthCallbackPage() {
  const session = useSession()
  const navigate = useNavigate()
  useEffect(() => {
    if (session.status === 'ready') {
      navigate(session.user ? '/overview' : '/login?error=expired', { replace: true })
    }
  }, [session.status, session.user, navigate])
  return <div className="public-shell auth-page"><header className="public-header"><Brand /></header>
    <main className="auth-main"><section className="auth-form-content"><h1>로그인 확인</h1>
      {session.status === 'unavailable' ? <><p className="auth-description" role="alert">{session.error}</p><Button className="github-auth-button" onClick={() => void session.refresh()}>다시 확인</Button><Link className="public-text-link" to="/login">로그인 화면으로</Link></> : <p className="auth-description" role="status"><LoaderCircle size={16} className="auth-spinner" /> 로그인 정보를 확인하고 있어요.</p>}
    </section></main><Footer /></div>
}
