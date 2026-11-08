import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { WeeklyOverview } from '../src/components/weekly-overview'

vi.mock('../src/components/ui/contribution-skyline', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/components/ui/contribution-skyline')>()
  return { ...actual, default: ({ data }: { data: { date: string; count: number }[] }) => <div data-testid="activity-days">{JSON.stringify(data)}</div> }
})

const project = { id: '1', name: '출시팀', description: '', role: 'OWNER', canManageRepositories: true }
const activity = { id: '41', type: 'ISSUE_ASSIGNED', title: '실제 팀의 작업 배정', summary: '로그인 화면의 담당자를 정했어요.', actor: 'our-team', issueId: '88', repositoryId: '2', pullRequestId: null, patchNoteId: null, occurredAt: '2026-11-08T12:00:00' }
const notification = { id: '51', title: '출시팀에서 내게 맡긴 작업', body: '로그인 화면을 확인해 주세요.', readAt: null, activity }
const dashboard = { weekStart: '2026-11-02', weekEnd: '2026-11-08', currentWeek: '2026-11-02', periodLabel: '이번 주', timezone: 'Asia/Seoul', total: 0, completed: 0, percentage: 0, carriedOver: 0, completedThisWeek: 0, states: {}, attentionCounts: { unassigned: 0, reviewAging: 0, changesRequested: 0 }, attention: [], people: [], recent: [], recentTotal: 0, fetchedAt: '2026-11-08T12:00:00' }
const page = <T,>(items: T[]) => ({ items, page: 1, hasNext: false })
function RouteProbe() { const location = useLocation(); return <div data-testid="route">{location.pathname}{location.search}</div> }
function mount(route: string) { return render(<MemoryRouter initialEntries={[route]}><App /><RouteProbe /></MemoryRouter>) }
function backend(override: (path: string, init?: RequestInit) => Response | Promise<Response> | undefined = () => undefined) {
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    const custom = override(input, init)
    if (custom) return custom
    if (input === '/api/me') return Response.json({ id: '7', login: 'our-team', displayName: '우리 팀원' })
    if (input === '/api/projects') return Response.json([project])
    if (input === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'test-csrf' })
    if (input.endsWith('/summary')) return Response.json({ issues: {}, mine: 0, unread: 1, repositories: 1, contributions: [{ date: '2026-11-08', count: 3 }] })
    if (input.endsWith('/repositories')) return Response.json([])
    if (input.includes('/pull-requests?')) return Response.json({ ...page([]), total: 0, counts: { open: 0, merged: 0, closed: 0 } })
    if (input.includes('/notifications?')) return Response.json(page([notification]))
    if (input.includes('/activities?')) return Response.json(page([activity]))
    if (input.endsWith('/sync-runs')) return Response.json(page([]))
    if (input.endsWith('/dashboard')) return Response.json(dashboard)
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

describe('출시용 워크스페이스의 실제 데이터 연결', () => {
  it('로그인 확인이 끝나기 전에 샘플 작업이나 알림을 먼저 보여주지 않는다', async () => {
    let finish!: (response: Response) => void
    backend(path => path === '/api/me' ? new Promise<Response>(resolve => { finish = resolve }) : undefined)
    mount('/inbox')
    expect(screen.getByRole('status', { name: '우리 팀의 워크스페이스를 확인하는 중' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '개인 알림함' })).not.toBeInTheDocument()
    await act(async () => finish(Response.json({ id: '7', login: 'our-team', displayName: '우리 팀원' })))
    expect(await screen.findByText(notification.title)).toBeInTheDocument()
  })

  it('세션 조회 실패를 비로그인 샘플 화면으로 바꾸지 않는다', async () => {
    backend(path => path === '/api/me' ? Response.json({ message: '서버에 연결하지 못했어요.' }, { status: 503 }) : undefined)
    mount('/inbox')
    expect(await screen.findByRole('heading', { name: '워크스페이스에 연결하지 못했어요' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '다시 연결하기' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '개인 알림함' })).not.toBeInTheDocument()
  })
  it('로그인한 알림함과 미리보기는 현재 프로젝트의 알림을 보여준다', async () => {
    const fetcher = backend()
    const user = userEvent.setup()
    mount('/inbox')
    const inbox = await screen.findByRole('region', { name: '개인 알림함' })
    expect(await within(inbox).findByText(notification.title)).toBeInTheDocument()
    expect(screen.queryByText(/주간 회의에서 다음 작업/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '알림', exact: true }))
    expect(screen.getAllByText(notification.title)).toHaveLength(2)
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/notifications?page=1&unread=true', expect.anything())
  })

  it('읽음 저장이 실패하면 알림과 현재 화면을 유지하고 재시도할 수 있다', async () => {
    let fail = true, read = false
    const fetcher = backend((path, init) => {
      if (init?.method === 'PATCH' && path.endsWith('/notifications/51')) {
        if (fail) return Response.json({ message: '읽음 상태를 저장하지 못했어요.' }, { status: 503 })
        read = true; return new Response(null, { status: 204 })
      }
      if (path.includes('/notifications?')) return Response.json(page(read ? [] : [notification]))
    })
    const user = userEvent.setup()
    mount('/inbox')
    await screen.findByText(notification.title)
    await user.click(screen.getByRole('button', { name: '읽음으로 표시' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('읽음 상태를 저장하지 못했어요.')
    expect(screen.getByText(notification.title)).toBeInTheDocument()
    expect(screen.getByTestId('route')).toHaveTextContent(/^\/inbox$/)
    fail = false
    await user.click(screen.getByRole('button', { name: '읽음으로 표시' }))
    expect(await screen.findByRole('heading', { name: '미확인 알림이 없어요' })).toBeInTheDocument()
    expect(fetcher.mock.calls.filter(([path, init]) => path.endsWith('/notifications/51') && init?.method === 'PATCH')).toHaveLength(2)
  })

  it('개발 기록에서 실제 작업으로 이동하며 관리 기록의 내부 코드를 노출하지 않는다', async () => {
    backend(path => path.includes('/activities?') ? Response.json(page([activity, { ...activity, id: '42', type: 'PROJECT_INVITATION_CREATED', title: '초대 링크를 만들었어요', summary: 'invitation=42; role=MEMBER; target=link holder' }])) : undefined)
    mount('/changes?view=history')
    const link = await screen.findByRole('link', { name: new RegExp(activity.title) })
    expect(link).toHaveAttribute('href', '/issues?issue=88')
    expect(screen.queryByText(/invitation=42/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '조회 기간' })).not.toBeInTheDocument()
    expect(screen.queryByText('샘플 프로젝트')).not.toBeInTheDocument()
  })

  it('이슈와 PR을 실제로 가져오며 한쪽이 실패해도 성공한 결과를 따로 안내한다', async () => {
    const fetcher = backend((path, init) => {
      if (init?.method === 'POST' && path.endsWith('/issues/sync')) return Response.json({ collected: 4, skippedRepositories: 1, hasMore: true })
      if (init?.method === 'POST' && path.endsWith('/pull-requests/sync')) return Response.json({ message: 'GitHub 접근 권한을 확인해 주세요.' }, { status: 403 })
    })
    const user = userEvent.setup()
    mount('/settings?tab=sync')
    await user.click(await screen.findByRole('button', { name: 'GitHub 최신 상태 가져오기' }))
    expect(await screen.findByRole('status')).toHaveTextContent('이슈 4개 확인 · 접근하지 못한 저장소 1개 · 남은 이슈')
    expect(await screen.findByRole('alert')).toHaveTextContent('PR: GitHub 접근 권한을 확인해 주세요.')
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(2)
    expect(screen.queryByText(/데모 데이터/)).not.toBeInTheDocument()
  })

  it('검색은 현재 프로젝트의 작업을 찾고 샘플 작업을 섞지 않는다', async () => {
    const fetcher = backend(path => path.includes('/issues?') ? Response.json({ ...page([{ id: '88', key: 'ISSUE-88', title: '우리 프로젝트 검색 결과', repositoryName: 'our-client' }]), total: 1 }) : undefined)
    const user = userEvent.setup()
    mount('/changes?view=history')
    await screen.findByText(activity.title)
    await user.keyboard('{Meta>}k{/Meta}')
    const dialog = screen.getByRole('dialog', { name: '프로젝트 검색' })
    expect(within(dialog).getByRole('navigation', { name: '빠른 이동' })).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText('프로젝트 검색어'), '로그인')
    expect(await within(dialog).findByRole('link', { name: /우리 프로젝트 검색 결과/ })).toHaveAttribute('href', '/issues?issue=88')
    expect(within(dialog).queryByText('컬렉션 공동 편집')).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path]) => path.startsWith('/api/projects/1/issues?') && new URL(path, 'http://test').searchParams.get('query') === '로그인')).toBe(true)
  })

  it('프로젝트가 없을 때 로그인 사용자에게 샘플 알림을 보여주지 않는다', async () => {
    const fetcher = backend(path => path === '/api/projects' ? Response.json([]) : undefined)
    mount('/inbox')
    expect(await screen.findByRole('heading', { name: '함께할 프로젝트를 선택해 주세요' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: '개인 알림함' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path]) => path.includes('/notifications?'))).toBe(false)
  })

  it('빌드 성공을 서비스 배포 완료로 표시하지 않고 해당 저장소의 실제 결과를 조회한다', async () => {
    const fetcher = backend(path => {
      if (path.endsWith('/repositories')) return Response.json([{ id: '2', projectId: '1', owner: 'our-team', name: 'client', status: 'CONNECTED' }])
      if (path.endsWith('/repositories/2/operations')) return Response.json({ builds: [{ name: '출시 빌드', branch: 'main', status: 'completed', conclusion: 'success', updatedAt: '2026-11-08T12:00:00Z' }], deployments: [], buildError: null, deploymentError: null })
    })
    mount('/deployments')
    expect(await screen.findByText('출시 빌드')).toBeInTheDocument()
    expect(screen.getByText('main · 성공')).toBeInTheDocument()
    expect(screen.getByText(/GitHub Deployments에 기록된 배포가 없어요/)).toBeInTheDocument()
    expect(screen.queryByText('배포 완료')).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/repositories/2/operations', expect.anything())
  })

  it('주간 선택과 별도로 프로젝트 활동을 조회하고 실패 시 가짜 잔디나 0건으로 바꾸지 않는다', async () => {
    let fail = true
    const fetcher = backend(path => path.endsWith('/summary') ? fail ? Response.json({ message: '활동 서버에 연결할 수 없어요.' }, { status: 503 }) : Response.json({ contributions: [{ date: '2026-11-08', count: 3 }] }) : undefined)
    render(<MemoryRouter><WeeklyOverview project="1" /></MemoryRouter>)
    expect(await screen.findByRole('progressbar')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('활동 서버에 연결할 수 없어요.')
    expect(screen.queryByTestId('activity-days')).not.toBeInTheDocument()
    fail = false
    await userEvent.click(screen.getByRole('button', { name: '다시 불러오기' }))
    expect(await screen.findByTestId('activity-days')).toHaveTextContent('2026-11-08')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/summary', expect.anything())
  })

  it('프로젝트를 전환하면 늦게 도착한 이전 프로젝트의 활동을 표시하지 않는다', async () => {
    let finishFirst!: (response: Response) => void
    backend(path => {
      if (path === '/api/projects/1/summary') return new Promise<Response>(resolve => { finishFirst = resolve })
      if (path === '/api/projects/2/summary') return Response.json({ contributions: [{ date: '2026-11-08', count: 2 }] })
      if (path === '/api/projects/2/dashboard') return Response.json(dashboard)
    })
    const view = render(<MemoryRouter><WeeklyOverview project="1" /></MemoryRouter>)
    await waitFor(() => expect(finishFirst).toBeDefined())
    view.rerender(<MemoryRouter><WeeklyOverview project="2" /></MemoryRouter>)
    expect(await screen.findByTestId('activity-days')).toHaveTextContent('"count":2')
    await act(async () => finishFirst(Response.json({ contributions: [{ date: '2026-11-08', count: 999 }] })))
    expect(screen.getByTestId('activity-days')).not.toHaveTextContent('999')
  })
})
