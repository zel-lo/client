import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'
import { invitationReturnPath, pendingInvitation, rememberInvitation } from '../src/lib/auth-return'
import { preferredProject } from '../src/lib/workspace'

vi.mock('../src/components/ui/contribution-skyline', () => ({ default: () => <div />, generateContributions: () => [] }))
const token = 'x'.repeat(43)
const path = `/invite/${token}`
const current = { id: '42', githubId: '123', login: 'octocat', displayName: '로그인 사용자', avatarUrl: null, email: null, theme: 'light' }
const project = { id: '9', name: '우리 팀', description: null, role: 'MEMBER', canManageRepositories: false, version: 0 }
function backend({ signedIn = true, status = 'PENDING', alreadyMember = false, mismatch = false } = {}) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/me') return signedIn ? Response.json(current) : new Response(null, { status: 401 })
    if (url === '/api/auth/status') return Response.json({ githubLoginEnabled: false })
    if (url === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (url === '/api/invitations/preview') {
      if (mismatch) return Response.json({ code: 'INVITATION_ACCOUNT_MISMATCH', message: '다른 GitHub 계정에 발급된 초대예요.' }, { status: 403 })
      return Response.json({ projectId: '9', projectName: '우리 팀', role: 'MEMBER', invitedBy: 'owner', expiresAt: '2026-11-04T00:00:00', status, alreadyMember, canAccept: !alreadyMember && status === 'PENDING' })
    }
    if (url === '/api/invitations/accept') return Response.json({ project, alreadyMember: false })
    if (url === '/api/projects') return Response.json([project])
    if (url.includes('/pull-requests')) return Response.json({ items: [], hasNext: false, counts: { open: 0, merged: 0, closed: 0 } })
    if (url.includes('/issues?')) return Response.json({ items: [], hasNext: false, total: 0 })
    if (url.endsWith('/repositories')) return Response.json([])
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const mount = (route = path) => render(<StrictMode><MemoryRouter initialEntries={[route]}><App /></MemoryRouter></StrictMode>)

describe('초대받은 사람의 참여 흐름', () => {
  it('로그인 전에는 프로젝트를 노출하거나 조회하지 않고 로그인과 가입 사이에 초대 경로를 유지한다', async () => {
    const fetcher = backend({ signedIn: false }); mount(); const user = userEvent.setup()
    await user.click(await screen.findByRole('link', { name: '로그인하고 초대 확인' }))
    expect(screen.getByRole('heading', { name: 'zello에 로그인' })).toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: '회원가입', exact: true })[0])
    await user.click(screen.getByRole('button', { name: 'GitHub로 시작하기' }))
    expect(await screen.findByRole('status')).toHaveTextContent('GitHub 로그인을 준비하고 있어요.')
    expect(pendingInvitation()).toBe(path)
    expect(fetcher.mock.calls.some(([url]) => url.includes('/invitations/'))).toBe(false)
    expect(screen.queryByText('우리 팀')).not.toBeInTheDocument()
  })
  it('방문만으로 참여하지 않고 명시적 수락 후 새 프로젝트를 선택한다', async () => {
    const fetcher = backend(); mount()
    const button = await screen.findByRole('button', { name: '프로젝트 참여하기' })
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/accept'))).toBe(false)
    expect(fetcher).toHaveBeenCalledWith('/api/invitations/preview', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token }), credentials: 'include' }))
    await userEvent.setup().click(button)
    await waitFor(() => expect(preferredProject('42')).toBe('9'))
    expect(fetcher).toHaveBeenCalledWith('/api/invitations/accept', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf' }, body: JSON.stringify({ token }) }))
  })
  it('OAuth 콜백은 StrictMode에서도 초대로 복귀하고 자동 수락하지 않는다', async () => {
    const fetcher = backend(); rememberInvitation(path); mount('/auth/callback')
    await screen.findByRole('button', { name: '프로젝트 참여하기' })
    expect(pendingInvitation()).toBeNull()
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/accept'))).toBe(false)
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/repositories'))).toBe(false)
  })
  it.each([['EXPIRED', '만료'], ['REVOKED', '취소'], ['ACCEPTED', '이미 사용']])('%s 링크는 참여 버튼을 제공하지 않는다', async (status, message) => {
    backend({ status }); mount()
    await screen.findByRole('heading', { name: '우리 팀에 초대받았어요' })
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(screen.queryByRole('button', { name: '프로젝트 참여하기' })).not.toBeInTheDocument()
  })
  it('다른 계정에 지정된 초대는 프로젝트 정보를 노출하지 않는다', async () => {
    backend({ mismatch: true }); mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 GitHub 계정')
    expect(screen.queryByRole('heading', { name: /우리 팀/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '프로젝트 참여하기' })).not.toBeInTheDocument()
  })
  it('기존 멤버는 수락 없이 기존 권한으로 프로젝트를 열 수 있다', async () => {
    const fetcher = backend({ alreadyMember: true }); mount()
    await userEvent.setup().click(await screen.findByRole('button', { name: '프로젝트로 이동' }))
    await waitFor(() => expect(preferredProject('42')).toBe('9'))
    expect(fetcher.mock.calls.some(([url]) => url.endsWith('/accept'))).toBe(false)
  })
  it('잘못된 형식의 링크는 서버에 보내지 않는다', async () => {
    const fetcher = backend(); mount('/invite/not-a-token')
    expect(await screen.findByRole('alert')).toHaveTextContent('올바르지 않은 초대 링크')
    expect(fetcher.mock.calls.some(([url]) => url.includes('/invitations/'))).toBe(false)
  })
})

describe('OAuth 복귀 경로 검증', () => {
  afterEach(() => vi.useRealTimers())
  it.each(['https://evil.example', '//evil.example', '/issues', `${path}?next=evil`, `/invite/${'x'.repeat(42)}`, '/invite/%2Fetc'])('외부 경로나 다른 경로 %s를 저장하지 않는다', unsafe => {
    expect(invitationReturnPath(unsafe)).toBeNull()
    rememberInvitation(unsafe)
    expect(pendingInvitation()).toBeNull()
  })
  it('15분 후 만료되고 이후 사용되지 않으며 한 번 소비하면 삭제된다', () => {
    vi.useFakeTimers(); rememberInvitation(path)
    expect(pendingInvitation()).toBe(path)
    vi.advanceTimersByTime(15 * 60 * 1000)
    expect(pendingInvitation()).toBeNull()
    rememberInvitation(path)
    expect(pendingInvitation(true)).toBe(path)
    expect(pendingInvitation()).toBeNull()
  })
  it('손상되거나 미래의 저장 값도 허용하지 않는다', () => {
    sessionStorage.setItem('zello.auth.returnTo', 'bad json')
    expect(pendingInvitation()).toBeNull()
    sessionStorage.setItem('zello.auth.returnTo', JSON.stringify({ path, createdAt: Date.now() + 60000 }))
    expect(pendingInvitation()).toBeNull()
  })
})
