import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Onboarding } from '../src/components/onboarding'
import { SessionProvider } from '../src/hooks/use-session'
import { useWorkWeek } from '../src/hooks/use-work-week'
import { preferredProject } from '../src/lib/workspace'
import { projectWeekCount, projectWeeks, startOfWeek, validProjectPeriod, validWeek, weekLabel } from '../src/lib/work-weeks'

const userRecord = { id: '42', githubId: '123', login: 'owner', displayName: '생성자', avatarUrl: null, email: null, theme: 'light' }
const project = { id: '1', name: '우리 팀', description: null, role: 'OWNER', canManageRepositories: true, version: 0, startDate: '2026-10-28', endDate: '2026-11-10', totalWeeks: 2 }
const source = { id: '30', fullName: 'team/server', owner: 'team', ownerType: 'ORGANIZATION', privateRepository: true, archived: false }
const repo = { id: '40', projectId: '1', githubRepositoryId: '30', owner: 'team', name: 'server', htmlUrl: 'https://github.com/team/server', initialSyncCompleted: false }
const inviteUrl = 'https://zello.example/#/invite/abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ'
function backend({ failConnection = false, failInvite = false, lostCreation = false } = {}) {
  let saved = false, connected = false
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/me') return Response.json(userRecord)
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (path === '/api/projects' && init?.method === 'POST') { saved = true; if (lostCreation) { lostCreation = false; throw new TypeError('생성 결과를 확인하지 못했어요.') }; return Response.json(project, { status: 201 }) }
    if (path === '/api/projects') return Response.json(saved ? [project] : [])
    if (path === '/api/projects/1') return Response.json(project)
    if (path === '/api/github/authorization') return Response.json({ organizationAccessUrl: null })
    if (path.includes('/api/github/accounts')) return Response.json({ items: [], page: 1, hasNext: false })
    if (path.includes('/api/github/repositories')) return Response.json({ items: [source], page: 1, hasNext: false })
    if (path === '/api/projects/1/repositories' && init?.method === 'POST') {
      if (failConnection) { failConnection = false; return Response.json({ code: 'WRITE_REJECTED', message: '저장소 연결을 다시 시도해 주세요.' }, { status: 503 }) }
      connected = true; return Response.json(repo, { status: 201 })
    }
    if (path === '/api/projects/1/repositories') return Response.json(connected ? [repo] : [])
    if (path.endsWith('/issues/sync')) return Response.json({ collected: 0, skippedRepositories: 0, hasMore: false })
    if (path.endsWith('/pull-requests/sync')) return Response.json({ collected: 0 })
    if (path.endsWith('/invitations') && init?.method === 'POST') {
      if (failInvite) { failInvite = false; return Response.json({ code: 'TEMPORARY_FAILURE', message: '초대 링크를 다시 만들어 주세요.' }, { status: 503 }) }
      return Response.json({ inviteUrl, invitation: { id: '7', role: 'MEMBER', expiresAt: '2026-11-04T00:00:00Z', status: 'PENDING' } })
    }
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return { fetcher }
}
function mount(path = '/onboarding?new=1') { return render(<MemoryRouter initialEntries={[path]}><SessionProvider><Routes><Route path="/onboarding" element={<Onboarding />} /><Route path="/issues" element={<h1>작업 보드</h1>} /></Routes></SessionProvider></MemoryRouter>) }
async function period(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('프로젝트 이름'), '우리 팀')
  fireEvent.change(screen.getByLabelText('프로젝트 시작일'), { target: { value: '2026-10-28' } })
  fireEvent.change(screen.getByLabelText('프로젝트 종료일'), { target: { value: '2026-11-10' } })
  await user.click(screen.getByRole('button', { name: '저장소 선택하기' }))
}
async function choose(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /이미 저장소가 있어요/ }))
  await user.click(await screen.findByRole('checkbox', { name: 'team/server · 비공개' }))
  await user.click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
}

describe('프로젝트 시작부터 팀 초대까지', () => {
  it('기간·저장소·초대 순서로 진행하고 실제 생성 요청에 기간과 재시도 키를 보낸다', async () => {
    const { fetcher } = backend(); mount(); const user = userEvent.setup()
    await period(user)
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    await choose(user)
    expect(await screen.findByLabelText('팀원 초대 링크')).toHaveValue(inviteUrl)
    const creation = fetcher.mock.calls.find(([path, init]) => path === '/api/projects' && init?.method === 'POST')!
    expect(JSON.parse(creation[1]!.body as string)).toMatchObject({ name: '우리 팀', startDate: project.startDate, endDate: project.endDate, requestKey: expect.stringMatching(/^[A-Za-z0-9-]{16,64}$/) })
    expect(fetcher.mock.calls.filter(([path, init]) => path.endsWith('/invitations') && init?.method === 'POST')).toHaveLength(1)
    expect(sessionStorage.getItem('zello.project-setup.42')).toBeNull()
    expect(JSON.stringify(localStorage)).not.toContain(inviteUrl)
    await user.click(screen.getByRole('button', { name: '프로젝트 시작하기' }))
    expect(screen.getByRole('heading', { name: '작업 보드' })).toBeInTheDocument()
    expect(preferredProject('42')).toBe('1')
  })
  it('저장소가 없는 경우 GitHub 생성 안내를 제공하고 돌아와 연결할 수 있다', async () => {
    const { fetcher } = backend(); mount(); const user = userEvent.setup(); await period(user)
    await user.click(screen.getByRole('button', { name: /새로 시작할래요/ }))
    expect(screen.getByRole('link', { name: 'GitHub에서 저장소 만들기' })).toHaveAttribute('href', 'https://github.com/new')
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    await user.click(screen.getByRole('button', { name: /만들었어요, 저장소 연결하기/ }))
    expect(await screen.findByRole('checkbox', { name: 'team/server · 비공개' })).toBeInTheDocument()
  })
  it('연결 실패 뒤 새로고침해도 만든 프로젝트를 재생성하지 않고 이어간다', async () => {
    const { fetcher } = backend({ failConnection: true }); const user = userEvent.setup(); const view = mount(); await period(user); await choose(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('저장소 연결을 다시 시도해 주세요.')
    view.unmount(); mount('/onboarding?new=1&project=1&step=repository')
    await user.click(await screen.findByRole('checkbox', { name: 'team/server · 비공개' }))
    await user.click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
    await screen.findByLabelText('팀원 초대 링크')
    expect(fetcher.mock.calls.filter(([path, init]) => path === '/api/projects' && init?.method === 'POST')).toHaveLength(1)
  })
  it('생성 응답을 잃으면 같은 키로 재시도하고 기간 설정을 유지한다', async () => {
    const { fetcher } = backend({ lostCreation: true }); mount(); const user = userEvent.setup(); await period(user); await choose(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('서버에 연결하지 못했어요.')
    await user.click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
    await screen.findByLabelText('팀원 초대 링크')
    const calls = fetcher.mock.calls.filter(([path, init]) => path === '/api/projects' && init?.method === 'POST')
    expect(calls).toHaveLength(2)
    expect(calls[0][1]!.body).toBe(calls[1][1]!.body)
  })
  it('초대 발급 실패는 프로젝트를 보존하고 초대만 다시 요청한다', async () => {
    const { fetcher } = backend({ failInvite: true }); mount(); const user = userEvent.setup(); await period(user); await choose(user)
    expect(await screen.findByRole('alert')).toHaveTextContent('초대 링크를 다시 만들어 주세요.')
    await user.click(screen.getByRole('button', { name: '다시 시도', exact: true }))
    await screen.findByLabelText('팀원 초대 링크')
    expect(fetcher.mock.calls.filter(([path, init]) => path === '/api/projects' && init?.method === 'POST')).toHaveLength(1)
  })
})

describe('기간에 따른 자동 주차', () => {
  it('시작일을 기준으로 주차를 만들고 마지막 주는 종료일까지만 표시한다', () => {
    expect(projectWeekCount(project)).toBe(2)
    expect(projectWeeks(project)).toEqual(['2026-10-28', '2026-11-04'])
    expect(startOfWeek('2026-11-03', project)).toBe('2026-10-28')
    expect(startOfWeek('2026-11-04', project)).toBe('2026-11-04')
    expect(startOfWeek('2026-12-30', project)).toBe('2026-11-04')
    expect(startOfWeek('2026-10-01', project)).toBe('2026-10-28')
    expect(weekLabel('2026-11-04', { ...project, endDate: '2026-11-06' })).toBe('11.4 – 11.6')
    expect(validWeek('2026-99-99', project)).toBe(startOfWeek(undefined, project))
    expect(validProjectPeriod({ startDate: '2026-11-01', endDate: '2026-10-31' })).toBe(false)
    expect(validProjectPeriod({ startDate: '2026-11-01', endDate: '2037-11-01' })).toBe(false)
  })
  it('프로젝트 주차 경계에서 열린 보드도 다음 주차로 자동 전환한다', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-03T14:59:59Z'))
    function Probe() { return <p>{useWorkWeek(project)}</p> }
    const view = render(<Probe />)
    expect(screen.getByText('2026-10-28')).toBeInTheDocument()
    act(() => { vi.setSystemTime(new Date('2026-11-03T15:00:01Z')); fireEvent(window, new Event('focus')) })
    expect(screen.getByText('2026-11-04')).toBeInTheDocument()
    view.unmount(); vi.useRealTimers()
  })
})
