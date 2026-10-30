import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'
import { beginGitHubLogin, endSession, getCurrentUser } from '../src/lib/session-api'

vi.mock('../src/components/ui/contribution-skyline', async importOriginal => {
  const original = await importOriginal<typeof import('../src/components/ui/contribution-skyline')>()
  return { ...original, default: () => <div aria-label="활동 시각화" /> }
})

const currentUser = { id: '42', githubId: '123', login: 'octocat', displayName: '로그인 사용자', avatarUrl: null, email: null, theme: 'light' }

describe('서버 세션 로그인 연결', () => {
  it('이미 로그인한 사용자는 홈에서 로그인 상태와 워크스페이스 이동을 본다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(currentUser)))
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await screen.findByText('로그인 사용자님 · 로그인됨')
    expect(screen.getByRole('link', { name: '워크스페이스로 이동' })).toHaveAttribute('href', '/overview')
    expect(screen.queryByRole('link', { name: '로그인', exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '프로젝트와 저장소 연결하기' })).toHaveAttribute('href', '/settings?tab=repositories')
  })

  it('로그인한 사용자가 로그인 페이지를 열면 워크스페이스로 이동한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(currentUser)))
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>)
    await screen.findByRole('heading', { name: /^전체 현황/ })
    expect(screen.getByText('@octocat · GitHub 로그인됨')).toBeInTheDocument()
  })

  it('다시 활성화한 탭에서 세션이 만료되면 로그인 상태를 갱신한다', async () => {
    let signedIn = true
    vi.stubGlobal('fetch', vi.fn(async () => signedIn ? Response.json(currentUser) : new Response(null, { status: 401 })))
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await screen.findByText('로그인 사용자님 · 로그인됨')
    signedIn = false
    window.dispatchEvent(new Event('focus'))
    await screen.findByRole('link', { name: '로그인', exact: true })
    expect(screen.queryByText('로그인 사용자님 · 로그인됨')).not.toBeInTheDocument()
  })

  it('GitHub 권한을 갱신하는 재로그인 화면은 기존 서비스 세션이 있어도 사용할 수 있다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(currentUser)))
    render(<MemoryRouter initialEntries={['/login?reauth=github']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('heading', { name: 'zello에 로그인' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'GitHub로 로그인' })).toBeEnabled()
  })
  it('로그인 시작은 서버 설정을 확인하고 OAuth 시작 주소로 이동한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ githubLoginEnabled: true }))
    vi.stubGlobal('fetch', fetcher)
    const redirect = vi.fn()
    await beginGitHubLogin(undefined, redirect)
    expect(fetcher).toHaveBeenCalledWith('/api/auth/status', expect.objectContaining({ credentials: 'include' }))
    expect(redirect).toHaveBeenCalledWith(new URL('/oauth2/authorization/github', window.location.origin).href)
  })

  it('서버가 설정되지 않았으면 로그인됐다고 처리하지 않는다', async () => {
    const redirect = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ githubLoginEnabled: false })))
    await expect(beginGitHubLogin(undefined, redirect)).rejects.toThrow('GitHub 로그인을 준비하고 있어요.')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('401은 비로그인으로 처리하고 서버 오류는 구분한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response(null, { status: 500 })))
    await expect(getCurrentUser()).resolves.toBeNull()
    await expect(getCurrentUser()).rejects.toThrow('로그인 상태를 확인하지 못했어요.')
  })

  it('네트워크 장애는 재시도할 수 있는 안내로 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(getCurrentUser()).rejects.toThrow('서버에 연결하지 못했어요.')
  })

  it('로그아웃은 새 CSRF 토큰을 받아 쿠키와 함께 POST한다', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await endSession()
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/auth/logout', expect.objectContaining({
      method: 'POST', credentials: 'include', headers: { 'X-CSRF-TOKEN': 'csrf-token' },
    }))
  })

  it('callback 이후 실제 회원을 표시하고 로그아웃하면 로그인 화면으로 이동한다', async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path === '/api/me') return Response.json(currentUser)
      if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-token' })
      if (path === '/api/auth/logout') return new Response(null, { status: 204 })
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter initialEntries={['/auth/callback']}><App /></MemoryRouter>)
    await screen.findByText('로그인 사용자')
    expect(screen.getByRole('heading', { name: /^전체 현황/ })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '로그아웃', exact: true }))
    await screen.findByRole('heading', { name: 'zello에 로그인' })
    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(localStorage.getItem('refreshToken')).toBeNull()
  })

  it('callback의 세션이 없으면 만료 안내를 표시한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    render(<MemoryRouter initialEntries={['/auth/callback']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('로그인 시간이 만료됐어요.'))
  })
})
