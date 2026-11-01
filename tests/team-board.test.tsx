import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LiveIssues } from '../src/components/live-issues'
import { belongsToWeek, completionDate, shiftWeek, startOfWeek } from '../src/lib/work-weeks'
import { useWorkWeek } from '../src/hooks/use-work-week'
import type { LiveIssue } from '../src/lib/project-api'

const project = { id: '1', name: '팀', description: null, role: 'OWNER', canManageRepositories: true }
const week = startOfWeek()
const seed: LiveIssue = { id: '20', version: 2, key: 'ZELLO-20', title: '보드에서 진행할 작업', description: '배경', status: 'TODO', priority: 'HIGH', source: 'REQUEST', meetingDate: null, meetingContext: '', acceptanceCriteria: '결과 확인', assignee: null, repositoryId: '10', repositoryOwner: 'team', repositoryName: 'server', number: 0, url: '', githubState: null, archived: false, publishStatus: 'LOCAL', lastPublishError: null, plannedWeekStart: shiftWeek(week, -1), boardOrder: 0, completedAt: null }
function setup({ fail = false, published = false, viewer = false, deferList = false } = {}) {
  let row = { ...seed, ...(published ? { publishStatus: 'PUBLISHED' as const, githubState: 'OPEN' as const, number: 7 } : {}) }
  let release: (() => void) | undefined
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (path.endsWith('/repositories')) return Response.json([{ id: '10', name: 'server', owner: 'team' }])
    if (path.includes('/assignees?')) return Response.json({ items: [{ id: 8, login: 'teammate' }], page: 1, hasNext: false })
    if (path === '/api/projects/1/issues/20' && init?.method === 'PATCH') {
      if (fail) return Response.json({ code: 'ISSUE_CHANGED', message: '다른 변경이 있어요.' }, { status: 409 })
      const body = JSON.parse(init.body as string)
      row = { ...row, ...body.details, version: row.version + 1, githubState: body.githubState, boardOrder: 1024 }
      return Response.json(row)
    }
    if (path === '/api/projects/1/issues/20') return Response.json(row)
    if (path.includes('/issues?')) {
      if (deferList) { await new Promise<void>(resolve => { release = resolve }); deferList = false }
      return Response.json({ items: [row], total: 1, page: 1, hasNext: false })
    }
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter><LiveIssues project={{ ...project, role: viewer ? 'VIEWER' : 'OWNER' }} /></MemoryRouter>)
  return { fetcher, release: () => release?.() }
}

describe('주간 작업 보드', () => {
  it('첫 조회는 접근 가능한 스켈레톤이고, 응답 후 이월 작업을 한 번만 표시한다', async () => {
    const backend = setup({ deferList: true })
    expect(screen.getByRole('status', { name: '저장한 작업을 불러오는 중' })).toHaveAttribute('aria-busy', 'true')
    await act(async () => backend.release())
    expect(await screen.findByText('전주 이월')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'ZELLO-20 보드에서 진행할 작업' })).toHaveLength(1)
    expect(screen.queryByRole('status', { name: '저장한 작업을 불러오는 중' })).not.toBeInTheDocument()
    const query = backend.fetcher.mock.calls.find(([path]) => path.includes('/issues?'))![0]
    expect(new URL(query, 'http://local').searchParams.get('week')).toBe(week)
  })
  it('메뉴로 빈 열에 옮기고 CSRF·최신 버전·위치를 서버에 저장한다', async () => {
    const { fetcher } = setup(); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'ZELLO-20 작업 메뉴' }))
    await user.click(screen.getByRole('menuitem', { name: '작업 중으로 이동' }))
    await waitFor(() => expect(within(screen.getByRole('region', { name: '작업 중 열' })).getByRole('button', { name: /보드에서 진행할 작업/ })).toBeInTheDocument())
    const write = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(write[1]!.body as string)).toMatchObject({ version: 2, details: { status: 'IN_PROGRESS', plannedWeekStart: seed.plannedWeekStart }, placement: { beforeId: null } })
    expect(write[1]!.headers).toMatchObject({ 'X-CSRF-TOKEN': 'csrf' })
  })
  it('저장 충돌 시 성공을 표시하지 않고 원래 열로 복구한다', async () => {
    setup({ fail: true }); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'ZELLO-20 작업 메뉴' }))
    await user.click(screen.getByRole('menuitem', { name: '작업 중으로 이동' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 변경이 있어요.')
    expect(within(screen.getByRole('region', { name: '이번에 할 일 열' })).getByRole('button', { name: /보드에서 진행할 작업/ })).toBeInTheDocument()
    expect(screen.queryByText(/작업 위치를 저장했어요/)).not.toBeInTheDocument()
  })
  it('담당자 지정에서 팀원을 선택하고 자기 배정 단축 버튼은 제공하지 않는다', async () => {
    const { fetcher } = setup(); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'ZELLO-20 담당자 지정' }))
    await user.click(await screen.findByRole('button', { name: 'teammate', exact: true }))
    await screen.findByRole('button', { name: /ZELLO-20 담당자 지정, 현재 teammate/ })
    const write = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(write[1]!.body as string).details.assignee).toBe('teammate')
    expect(screen.queryByRole('button', { name: /내가 하기|내가 맡기/ })).not.toBeInTheDocument()
  })
  it('발행된 작업 완료는 GitHub 이슈 닫기 안내 후 실행한다', async () => {
    const { fetcher } = setup({ published: true }); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'ZELLO-20 작업 메뉴' }))
    await user.click(screen.getByRole('menuitem', { name: '완료로 이동' }))
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    await user.click(screen.getByRole('button', { name: '완료하고 GitHub 이슈 닫기' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(true))
    const write = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(write[1]!.body as string)).toMatchObject({ details: { status: 'DONE' }, githubState: 'CLOSED' })
  })
  it('조회 전용 멤버에게 드래그와 담당자 변경을 허용하지 않는다', async () => {
    setup({ viewer: true })
    expect(await screen.findByRole('button', { name: 'ZELLO-20 담당자 지정' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'ZELLO-20 작업 메뉴' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /끌어서 옮기기/ })).not.toBeInTheDocument()
  })
  it('주차 전환은 서버 조회 조건을 바꾸고 이전 작업을 복제하지 않는다', async () => {
    const { fetcher } = setup(); const user = userEvent.setup()
    await screen.findByText('전주 이월')
    await user.click(screen.getByRole('button', { name: '다음 주' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([path]) => path.includes(`week=${shiftWeek(week, 1)}`))).toBe(true))
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })
})

describe('주차와 이월 기준', () => {
  it('연말·윤년에도 월요일 기준 날짜를 유지하고 한국 시간의 완료 주차로 분류한다', () => {
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28')
    expect(shiftWeek('2024-02-26', 1)).toBe('2024-03-04')
    expect(completionDate('2026-11-01T15:30:00')).toBe('2026-11-02')
    expect(belongsToWeek({ status: 'done', completedAt: '2026-11-01T15:30:00Z' }, '2026-11-02')).toBe(true)
    expect(belongsToWeek({ status: 'done', completedAt: '2026-11-01T15:30:00Z' }, '2026-10-26')).toBe(false)
    const unfinished = { status: 'in_progress' as const, plannedWeekStart: '2026-10-19' }
    expect(belongsToWeek(unfinished, '2026-11-02')).toBe(true)
    expect(unfinished.plannedWeekStart).toBe('2026-10-19')
    expect(belongsToWeek({ status: 'todo', plannedWeekStart: '2026-11-09' }, '2026-11-02')).toBe(false)
  })
  it('열어둔 보드도 한국 시간 월요일에 새 주차로 전환된다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T14:59:40Z'))
    function Probe() { return <p>{useWorkWeek()}</p> }
    const view = render(<Probe />)
    expect(screen.getByText('2026-10-26')).toBeInTheDocument()
    act(() => { vi.setSystemTime(new Date('2026-11-01T15:00:10Z')); fireEvent(window, new Event('focus')) })
    expect(screen.getByText('2026-11-02')).toBeInTheDocument()
    view.unmount(); vi.useRealTimers()
  })
})

describe('키보드 조작', () => {
  it('키보드로 드래그를 취소하고 작업 메뉴에서 단계를 옮긴다', async () => {
    const { TeamBoard } = await import('../src/components/team-board')
    const move = vi.fn()
    const actions = { onOpen: vi.fn(), onMove: move, onAssign: vi.fn(), loadAssignees: async () => ({ items: [], hasNext: false }) }
    const user = userEvent.setup()
    render(<TeamBoard items={[{ id: 'a', key: 'Z-1', title: '키보드 작업', status: 'todo', priority: 'medium', repositoryId: 'repo', repositoryName: 'server', assignee: null, sourceLabel: '수시 요청', plannedWeekStart: week }]} week={week} actions={actions} />)
    const handle = screen.getByRole('button', { name: 'Z-1 끌어서 옮기기' })
    handle.focus()
    await user.keyboard('[Space]')
    await waitFor(() => expect(handle).toHaveAttribute('aria-pressed', 'true'))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(handle).not.toHaveAttribute('aria-pressed', 'true'))
    expect(move).not.toHaveBeenCalled()
    screen.getByRole('button', { name: 'Z-1 작업 메뉴' }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('menuitem', { name: '백로그로 이동' })
    await user.keyboard('{ArrowDown}{Enter}')
    expect(move).toHaveBeenCalledWith({ id: 'a', status: 'in_progress', beforeId: null })
  })
})
