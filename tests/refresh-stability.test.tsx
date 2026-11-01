import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SessionProvider, useSession } from '../src/hooks/use-session'
import { useLivePullRequests } from '../src/hooks/use-pull-requests'

const current = { id: '42', githubId: '123', login: 'octocat', displayName: '사용자', avatarUrl: null, email: null, theme: 'light' }
function SessionProbe() {
  const session = useSession()
  return session.status === 'loading' ? <p>로그인 확인 화면</p> : <><p>{session.user?.login ?? '게스트'}</p><input aria-label="작성 중인 내용" defaultValue="초안" /></>
}
function ProjectProbe() {
  const live = useLivePullRequests(true, '/pull-requests', '42')
  return <><p>{live.loading ? '목록 로딩 화면' : '목록 준비됨'}</p><button onClick={() => void live.reload()}>수동 새로고침</button></>
}

describe('입력 중 백그라운드 새로고침', () => {
  it('세션을 재검사하는 동안 화면과 포커스를 유지하고 focus 중복 이벤트를 제한한다', async () => {
    let resolve: (response: Response) => void = () => {}
    let calls = 0
    const fetcher = vi.fn(async () => ++calls === 1 ? Response.json(current) : new Promise<Response>(done => { resolve = done }))
    vi.stubGlobal('fetch', fetcher)
    render(<SessionProvider><SessionProbe /></SessionProvider>)
    await screen.findByText('octocat')
    const input = screen.getByRole('textbox', { name: '작성 중인 내용' }); const user = userEvent.setup()
    await user.type(input, ' 유지')
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('로그인 확인 화면')).not.toBeInTheDocument()
    expect(input).toHaveValue('초안 유지'); expect(input).toHaveFocus()
    fireEvent(window, new Event('focus')); fireEvent(document, new Event('visibilitychange'))
    expect(fetcher).toHaveBeenCalledTimes(2)
    await act(async () => resolve(Response.json(current)))
    expect(input).toHaveFocus(); expect(input).toHaveValue('초안 유지')
  })
  it('일반 focus로 프로젝트 목록을 재조회하지 않고 수동 갱신 중에도 기존 목록을 유지한다', async () => {
    let pending = false
    let resolve: (response: Response) => void = () => {}
    const projects = [{ id: '1', name: '프로젝트', role: 'OWNER', description: null, canManageRepositories: true }]
    const fetcher = vi.fn(async (path: string) => path === '/api/projects'
      ? pending ? new Promise<Response>(done => { resolve = done }) : Response.json(projects)
      : Response.json({ items: [], counts: { open: 0, merged: 0, closed: 0 }, hasNext: false }))
    vi.stubGlobal('fetch', fetcher)
    render(<ProjectProbe />)
    await screen.findByText('목록 준비됨')
    const before = fetcher.mock.calls.length
    fireEvent(window, new Event('focus')); fireEvent(window, new Event('focus'))
    expect(fetcher).toHaveBeenCalledTimes(before)
    pending = true
    await userEvent.setup().click(screen.getByRole('button', { name: '수동 새로고침' }))
    expect(screen.queryByText('목록 로딩 화면')).not.toBeInTheDocument()
    await act(async () => resolve(Response.json(projects)))
    expect(screen.getByText('목록 준비됨')).toBeInTheDocument()
  })
})
