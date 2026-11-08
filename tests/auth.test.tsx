import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import App from '../src/App'
import { githubAuthUrl } from '../src/lib/auth'

vi.mock('../src/components/ui/contribution-skyline', () => ({ default: () => <div />, generateContributions: () => [] }))

function RouteProbe() { const location = useLocation(); return <div data-testid="auth-route">{location.pathname}{location.search}</div> }
function mount(route = '/') {
  return render(<MemoryRouter initialEntries={[route]}><App /><RouteProbe /></MemoryRouter>)
}

describe('메인과 GitHub 로그인 흐름', () => {
  it('메인에서 하나의 GitHub 시작 화면으로 이동한다', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Git에 익숙하지 않아도괜찮아요.')
    expect(screen.queryByRole('link', { name: '회원가입' })).not.toBeInTheDocument()
    expect(await screen.findByRole('link', { name: '시작하기' })).toHaveAttribute('href', '/login')
    await user.click(screen.getByRole('link', { name: /GitHub로 시작하기/ }))
    expect(screen.getByRole('heading', { name: 'zello 시작하기' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GitHub로 계속하기' })).toBeInTheDocument()
    expect(screen.getByText(/처음이라면 계정이 만들어지고/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '회원가입' })).not.toBeInTheDocument()
  })

  it('기존 가입 주소도 초대 경로와 OAuth 오류·재연결 조건을 보존해 시작 화면으로 연결한다', async () => {
    const next = '/invite/' + 'x'.repeat(43)
    const query = new URLSearchParams({ next, error: 'expired', reauth: 'github' }).toString()
    mount(`/signup?${query}`)
    await waitFor(() => expect(screen.getByTestId('auth-route')).toHaveTextContent(`/login?${query}`))
    expect(screen.getByRole('heading', { name: 'zello 시작하기' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('로그인 시간이 만료됐어요.')
    expect(screen.getByText(/초대받은 프로젝트로 안내/)).toBeInTheDocument()
    expect(screen.getByText(/접근 권한을 갱신/)).toBeInTheDocument()
  })

  it('연결 전에는 안내를 표시하고 별도의 샘플 둘러보기는 제공하지 않는다', async () => {
    const user = userEvent.setup()
    mount('/signup')
    await user.click(screen.getByRole('button', { name: 'GitHub로 계속하기' }))
    expect(screen.getByRole('status')).toHaveTextContent('GitHub 로그인을 준비하고 있어요.')
    expect(localStorage.getItem('gyeol.issues.v1')).toBeNull()
    expect(screen.queryByRole('link', { name: /둘러보기/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'zello 홈' }))
    expect(screen.getByRole('link', { name: /GitHub로 시작하기/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /둘러보기/ })).not.toBeInTheDocument()
  })

  it.each([
    ['access_denied', '취소됐어요'], ['expired', '만료됐어요'], ['failed', '실패했어요'],
  ])('OAuth 오류 %s를 안내하고 재시도 버튼을 제공한다', (error, message) => {
    mount(`/login?error=${error}`)
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'GitHub로 계속하기' })).toBeEnabled()
  })

  it('본문 바로가기는 해시 라우트를 바꾸지 않고 본문에 초점을 맞춘다', async () => {
    const user = userEvent.setup()
    mount('/signup')
    await user.click(screen.getByRole('link', { name: '본문으로 이동' }))
    expect(document.getElementById('public-main')).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'zello 시작하기' })).toBeInTheDocument()
  })

  it('시작 화면과 메인 사이에 선택한 테마를 유지한다', async () => {
    const user = userEvent.setup()
    mount('/login')
    await user.click(screen.getByRole('button', { name: '어두운 테마로 전환' }))
    await user.click(screen.getByRole('link', { name: 'zello 홈' }))
    await user.click(screen.getByRole('link', { name: '시작하기' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: '밝은 테마로 전환' })).toBeInTheDocument()
  })

  it('로그인 서버가 응답하지 않으면 안내하고 다시 시도할 수 있다', async () => {
    const fetcher = vi.fn(async (path: string) => path === '/api/auth/status' ? new Response(null, { status: 503 }) : new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    mount('/login')
    await user.click(screen.getByRole('button', { name: 'GitHub로 계속하기' }))
    expect(await screen.findByRole('status')).toHaveTextContent('로그인 서버에 연결하지 못했어요.')
    expect(screen.getByRole('button', { name: 'GitHub로 계속하기' })).toBeEnabled()
  })

  it('GitHub로 이동을 준비하는 동안 중복 요청을 보내지 않는다', async () => {
    let finish!: (response: Response) => void
    const fetcher = vi.fn((path: string) => path === '/api/auth/status' ? new Promise<Response>(resolve => { finish = resolve }) : Promise.resolve(new Response(null, { status: 401 })))
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    mount('/login')
    await user.click(screen.getByRole('button', { name: 'GitHub로 계속하기' }))
    const pending = screen.getByRole('button', { name: 'GitHub로 이동 중' })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(fetcher.mock.calls.filter(([path]) => path === '/api/auth/status')).toHaveLength(1)
    await act(async () => finish(Response.json({ githubLoginEnabled: false })))
    expect(await screen.findByRole('button', { name: 'GitHub로 계속하기' })).toBeEnabled()
  })

})

describe('OAuth 시작 주소', () => {
  it('HTTPS와 로컬 개발 서버를 허용한다', () => {
    expect(githubAuthUrl('https://api.example.com/oauth2/authorization/github')).toBe('https://api.example.com/oauth2/authorization/github')
    expect(githubAuthUrl('http://localhost:8080/oauth2/authorization/github')).toBe('http://localhost:8080/oauth2/authorization/github')
  })
  it.each([undefined, '', '/missing', 'javascript:alert(1)', 'http://api.example.com/login', 'https://secret@example.com/login'])('잘못된 주소 %s로 이동하지 않는다', value => {
    expect(githubAuthUrl(value)).toBeNull()
  })
})
