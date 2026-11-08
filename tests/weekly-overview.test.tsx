import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { WeeklyDashboardView, WeeklyOverview } from '../src/components/weekly-overview'
import type { WeeklyDashboard } from '../src/lib/weekly-dashboard'
import { LiveIssues } from '../src/components/live-issues'

const data: WeeklyDashboard = {
  weekStart: '2026-11-02', weekEnd: '2026-11-08', currentWeek: '2026-11-02', periodLabel: '이번 주', timezone: 'Asia/Seoul', total: 12, completed: 5, percentage: 42, carriedOver: 2, completedThisWeek: 6,
  states: { TODO: 3, IN_PROGRESS: 2, IN_REVIEW: 2, DONE: 5 }, attentionCounts: { unassigned: 1, reviewAging: 1, changesRequested: 1 },
  attention: [
    { id: '31', kind: 'CHANGES_REQUESTED', title: '검색 응답 개선', repository: 'server', owner: 'minsu', ageDays: 4, timeLabel: '수정 요청 후 4일', reviewers: [] },
    { id: '32', kind: 'REVIEW_AGING', title: '로그인 기능 검토', repository: 'client', owner: 'minsu', ageDays: 3, timeLabel: '검토 요청 3일', reviewers: ['subin'] },
    { id: '33', kind: 'UNASSIGNED', title: '알림 동작 정리', repository: 'client', owner: null, ageDays: null, timeLabel: '담당자 지정 필요', reviewers: [] },
  ],
  people: [{ login: 'subin', name: '수빈', avatarUrl: null, jobTitle: 'PM', inProgress: 2, reviewing: 1, completed: 3, assigned: 3,
    tasks: [{ id: '34', type: 'ISSUE', title: '내가 담당한 작업', status: 'IN_PROGRESS', repository: 'client' }, { id: '32', type: 'PR', title: '내가 검토할 PR', status: 'REVIEW_REQUESTED', repository: 'server' }] }],
  recent: [{ id: '35', type: 'ISSUE', title: '팀에서 직접 작성한 반영 제목', owner: 'minsu', repository: 'server', completedAt: '2026-11-02T01:00:00', needsTitle: false }], recentTotal: 6, fetchedAt: '2026-11-08T00:00:00',
}

describe('주간 PM 대시보드', () => {
  it('진행률과 상태별 작업을 표시하고 실제 작업과 PR로 연결한다', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><WeeklyDashboardView data={data} /></MemoryRouter>)
    expect(screen.getByRole('progressbar', { name: '이번 주 작업 완료율' })).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByRole('link', { name: /진행 중5개/ })).toHaveAttribute('href', '/issues?week=2026-11-02&status=IN_PROGRESS')
    expect(screen.getByRole('link', { name: /수정 요청 후 4일/ })).toHaveAttribute('href', '/pull-requests?pr=31')
    expect(screen.getByRole('link', { name: /팀에서 직접 작성한 반영 제목/ })).toHaveAttribute('href', '/issues?issue=35')
    await user.click(screen.getByRole('button', { name: '담당자 없음1' }))
    expect(screen.getByRole('link', { name: /알림 동작 정리/ })).toHaveAttribute('href', '/issues?issue=33')
    expect(screen.queryByRole('link', { name: /검색 응답 개선/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '수빈 업무 담당 보기' }))
    expect(screen.getByRole('link', { name: /내가 담당한 작업/ })).toHaveAttribute('href', '/issues?issue=34')
    expect(screen.getByRole('link', { name: /내가 검토할 PR/ })).toHaveAttribute('href', '/pull-requests?pr=32')
    expect(screen.getByRole('link', { name: '담당 작업 모두 보기' })).toHaveAttribute('href', '/issues?assignee=subin&week=2026-11-02')
    expect(screen.getByRole('dialog', { name: '업무 담당' })).toBeInTheDocument()
    expect(screen.queryByLabelText('검토할 PR 1개')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '업무 담당' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '수빈 업무 담당 보기' })).toHaveFocus()
  })
  it('작업이 없는 프로젝트는 0%와 시작 안내를 표시한다', () => {
    render(<MemoryRouter><WeeklyDashboardView data={{ ...data, total: 0, completed: 0, percentage: 0, carriedOver: 0, completedThisWeek: 0, states: {}, attention: [], attentionCounts: { unassigned: 0, reviewAging: 0, changesRequested: 0 }, people: [], recent: [], recentTotal: 0 }} /></MemoryRouter>)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByText('이번 주에 할 작업을 정해 보세요')).toBeInTheDocument()
    expect(screen.getByText('지금은 순조롭게 진행 중이에요')).toBeInTheDocument()
    expect(screen.getByText('함께할 팀원을 초대해 보세요')).toBeInTheDocument()
    expect(screen.getByText('완료한 작업이 여기에 차곡차곡 모여요.')).toBeInTheDocument()
  })
  it('프로젝트가 바뀌면 이전 프로젝트의 늦은 응답을 표시하지 않는다', async () => {
    let finishFirst!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn((path: string) => path.includes('/1/') ? new Promise<Response>(resolve => { finishFirst = resolve }) : Promise.resolve(Response.json({ ...data, percentage: 100 }))))
    const view = render(<MemoryRouter><WeeklyOverview project="1" /></MemoryRouter>)
    view.rerender(<MemoryRouter><WeeklyOverview project="2" /></MemoryRouter>)
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    await act(async () => { finishFirst(Response.json(data)) })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })
  it('서버 조회 실패를 빈 프로젝트로 표시하지 않고 재시도한다', async () => {
    let fail = true
    vi.stubGlobal('fetch', vi.fn(async () => { if (fail) return Response.json({ message: '현황을 불러오지 못했어요.' }, { status: 503 }); return Response.json(data) }))
    const user = userEvent.setup()
    render(<MemoryRouter><WeeklyOverview project="1" /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('현황을 불러오지 못했어요.')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }))
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })
  it('로그인한 전체 현황에서는 샘플 대신 현재 프로젝트 대시보드를 조회한다', async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path === '/api/me') return Response.json({ id: '7', login: 'subin', displayName: '수빈' })
      if (path === '/api/projects') return Response.json([{ id: '1', name: '우리 팀 프로젝트', role: 'OWNER' }])
      if (path.endsWith('/dashboard')) return Response.json(data)
      if (path.includes('/pull-requests?')) return Response.json({ items: [], page: 1, hasNext: false, total: 0, counts: { open: 0, merged: 0, closed: 0 } })
      if (path.endsWith('/repositories')) return Response.json([])
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter initialEntries={['/overview']}><App /></MemoryRouter>)
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42'))
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/dashboard', expect.anything())
    expect(screen.queryByText('샘플 데이터')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '저장소 필터' })).not.toBeInTheDocument()
  })
  it('담당자와 상태 링크는 팀 작업 목록의 조회 조건으로 전달한다', async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path.endsWith('/repositories')) return Response.json([])
      if (path.includes('/issues?')) return Response.json({ items: [], page: 1, hasNext: false, total: 0 })
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter initialEntries={['/issues?assignee=subin&status=IN_PROGRESS']}><LiveIssues project={{ id: '1', name: '프로젝트', description: null, role: 'OWNER', canManageRepositories: true }} /></MemoryRouter>)
    await waitFor(() => expect(fetcher.mock.calls.some(([path]) => path.includes('/issues?') && path.includes('assignee=subin') && path.includes('status=IN_PROGRESS'))).toBe(true))
    expect(screen.getByLabelText('진행 상태')).toHaveValue('IN_PROGRESS')
    expect(screen.getByLabelText('담당자 필터')).toHaveValue('subin')
  })

  it('이전 주와 이번 주로 이동하면 조회 조건과 진행률·완료 목록이 함께 바뀐다', async () => {
    function RouteProbe() { const location = useLocation(); return <div data-testid="week-route">{location.search}</div> }
    const fetcher = vi.fn(async (path: string) => {
      const week = new URL(path, 'http://test').searchParams.get('week')
      return Response.json(week ? { ...data, weekStart: week, weekEnd: '2026-11-01', periodLabel: '지난 주', percentage: 20, completedThisWeek: 1, recentTotal: 1,
        recent: [{ ...data.recent[0], title: '지난 주에 완료한 작업' }] } : data)
    })
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/overview?view=weekly']}><WeeklyOverview project="1" /><RouteProbe /></MemoryRouter>)
    await screen.findByRole('progressbar', { name: '이번 주 작업 완료율' })
    expect(screen.getByRole('heading', { name: '업무 담당' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '이전 주' }))
    expect(await screen.findByRole('progressbar', { name: '지난 주 작업 완료율' })).toHaveAttribute('aria-valuenow', '20')
    expect(screen.getByLabelText('조회 주차')).toHaveValue('2026-10-26')
    expect(screen.getByTestId('week-route')).toHaveTextContent('view=weekly&week=2026-10-26')
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/dashboard?week=2026-10-26', expect.anything())
    expect(screen.getByRole('link', { name: /지난 주에 완료한 작업/ })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /팀에서 직접 작성한 반영 제목/ })).not.toBeInTheDocument()
    expect(screen.getByText('선택한 주 완료와 현재 미완료 작업 기준 · 백로그 제외')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '이번 주', exact: true }))
    expect(await screen.findByRole('progressbar', { name: '이번 주 작업 완료율' })).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByTestId('week-route')).toHaveTextContent('?view=weekly')
    expect(screen.getByTestId('week-route')).not.toHaveTextContent('week=')
  })

  it('프로젝트 기간의 주차를 선택하고 첫 주·마지막 주의 이동 범위를 지킨다', async () => {
    const select = vi.fn(), user = userEvent.setup()
    const projectData = { ...data, currentWeek: '2026-11-04', weekStart: '2026-11-04', weekEnd: '2026-11-10', projectStartDate: '2026-11-04', projectEndDate: '2026-11-19' }
    const view = render(<MemoryRouter><WeeklyDashboardView data={projectData} onWeekChange={select} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '이전 주' })).toBeDisabled()
    const picker = screen.getByRole('combobox', { name: '조회 주차' })
    expect(picker.querySelectorAll('option')).toHaveLength(3)
    await user.selectOptions(picker, '2026-11-18')
    expect(select).toHaveBeenCalledWith('2026-11-18')
    view.rerender(<MemoryRouter><WeeklyDashboardView data={{ ...projectData, weekStart: '2026-11-18', weekEnd: '2026-11-19', periodLabel: '3주차' }} onWeekChange={select} /></MemoryRouter>)
    expect(screen.getByRole('button', { name: '다음 주' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '이번 주', exact: true }))
    expect(select).toHaveBeenLastCalledWith('2026-11-04')
  })

  it('잘못된 주차 주소에서도 이번 주로 돌아가 조회할 수 있다', async () => {
    const fetcher = vi.fn(async (path: string) => path.includes('?week=') ? Response.json({ message: '프로젝트 기간 안의 주차를 선택해 주세요.' }, { status: 400 }) : Response.json(data))
    vi.stubGlobal('fetch', fetcher)
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/overview?week=2026-11-05']}><WeeklyOverview project="1" /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('프로젝트 기간 안의 주차를 선택해 주세요.')
    await user.click(screen.getByRole('button', { name: '이번 주로 돌아가기' }))
    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
  })
})
