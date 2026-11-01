import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { preferredProject, rememberProjectForUser } from '../src/lib/workspace'

vi.mock('../src/components/ui/contribution-skyline', () => ({ default: () => <div />, generateContributions: () => [] }))
const current = { id: '42', githubId: '123', login: 'octocat', displayName: '나', avatarUrl: null, email: null, theme: 'light' }
const projectA = { id: '1', name: '다른 공간', role: 'OWNER', canManageRepositories: true, description: '', version: 0 }
const projectB = { ...projectA, id: '2', name: 'ㅎㅇ' }
function backend() {
  let projects = [projectA, projectB]
  const fetcher = vi.fn(async (path: string, _init?: RequestInit) => {
    if (path === '/api/me') return Response.json(current)
    if (path === '/api/projects') return Response.json(projects)
    if (path === '/api/github/authorization') return Response.json({ organizationAccessUrl: null })
    if (path.startsWith('/api/github/accounts')) return Response.json({ items: [], page: 1, hasNext: false })
    if (path.startsWith('/api/github/repositories')) return Response.json({ items: [], page: 1, hasNext: false })
    const scoped = path.match(/^\/api\/projects\/(\d+)(.*)$/)
    if (scoped) {
      const project = projects.find(item => item.id === scoped[1])
      if (!project) return Response.json({ code: 'PROJECT_NOT_FOUND', message: '프로젝트를 찾을 수 없어요.' }, { status: 404 })
      const suffix = scoped[2]
      if (!suffix) return Response.json(project)
      if (suffix.startsWith('/pull-requests')) return Response.json({ items: [], counts: { open: 0, merged: 0, closed: 0 }, hasNext: false })
      if (suffix.startsWith('/issues?')) return Response.json({ items: [], total: 0, hasNext: false })
      if (suffix === '/repositories') return Response.json([{ id: `repo-${project.id}`, projectId: project.id, githubRepositoryId: `remote-${project.id}`, owner: 'team', name: `server-${project.id}`, htmlUrl: `https://github.com/team/server-${project.id}`, description: '', language: 'Java', defaultBranch: 'main', privateRepository: false, initialSyncCompleted: true }])
      if (suffix.startsWith('/members?')) return Response.json({ items: [{ userId: '42', githubId: '123', login: 'octocat', displayName: `${project.name} 멤버`, role: 'OWNER', version: 0, self: true, canChangeRole: false, canRemove: false, canTransferTo: false }], total: 1, page: 1, hasNext: false, projectName: project.name, projectVersion: 0, currentMemberVersion: 0, ownerUserId: '42', canInvite: true, canInviteAdmin: true })
      if (suffix.startsWith('/invitations?')) return Response.json({ items: [], total: 0, page: 1, hasNext: false })
      if (suffix.startsWith('/membership-history?')) return Response.json({ items: [], page: 1, hasNext: false })
    }
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return { fetcher, revokeB: () => { projects = [projectA] } }
}
function mount(route = '/settings?tab=repositories') { return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>) }

describe('프로젝트 안에서 유지되는 작업 범위', () => {
  it('탭마다 재선택하지 않고 현재 프로젝트의 이슈·멤버·저장소를 사용한다', async () => {
    const { fetcher } = backend(); rememberProjectForUser('42', '2'); mount('/issues'); const user = userEvent.setup()
    await screen.findByText('아직 표시할 작업이 없어요')
    expect(screen.queryByRole('combobox', { name: '현재 프로젝트' })).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: '프로젝트 설정', exact: true }).at(-1)!)
    await screen.findByRole('textbox', { name: '프로젝트 이름' })
    expect(screen.getByRole('textbox', { name: '프로젝트 이름' })).toHaveValue('ㅎㅇ')
    await user.click(screen.getByRole('link', { name: '멤버', exact: true }))
    await screen.findByText('ㅎㅇ 멤버')
    await user.click(screen.getByRole('link', { name: '저장소 연결', exact: true }))
    await screen.findByRole('heading', { name: 'ㅎㅇ의 저장소' })
    await screen.findByRole('link', { name: 'team/server-2' })
    expect(screen.queryByRole('combobox', { name: '연결할 프로젝트' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '프로젝트 만들기' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path]) => path.startsWith('/api/projects/1/'))).toBe(false)
    expect(preferredProject('42')).toBe('2')
  })
  it('사이드바에서만 프로젝트를 전환하며 저장소 탭도 새 프로젝트로 함께 바뀐다', async () => {
    backend(); rememberProjectForUser('42', '2'); mount(); const user = userEvent.setup()
    await screen.findByRole('link', { name: 'team/server-2' })
    await user.click(screen.getByLabelText('프로젝트 전환'))
    const currentButton = screen.getByRole('button', { name: 'ㅎㅇ 프로젝트로 전환' })
    expect(currentButton).toHaveAttribute('aria-pressed', 'true')
    expect(currentButton).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '다른 공간 프로젝트로 전환' }))
    await screen.findByRole('link', { name: 'team/server-1' })
    expect(screen.queryByRole('link', { name: 'team/server-2' })).not.toBeInTheDocument()
    expect(preferredProject('42')).toBe('1')
    expect(screen.getByRole('heading', { name: '다른 공간의 저장소' })).toBeInTheDocument()
  })
  it('현재 프로젝트 접근이 사라져도 다른 프로젝트로 자동 이동하지 않는다', async () => {
    const { fetcher, revokeB } = backend(); rememberProjectForUser('42', '2'); mount()
    await screen.findByRole('link', { name: 'team/server-2' })
    revokeB()
    await act(async () => { window.dispatchEvent(new Event('zello:projects-changed')) })
    await screen.findByRole('heading', { name: '사이드바에서 프로젝트를 선택해 주세요' })
    expect(screen.queryByRole('link', { name: 'team/server-2' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path]) => path.startsWith('/api/projects/1/'))).toBe(false)
    expect(preferredProject('42')).toBe('2')
  })
  it('기존 회원이 연결 안내로 들어가면 현재 프로젝트 설정으로 안내한다', async () => {
    backend(); rememberProjectForUser('42', '2'); mount('/onboarding')
    await screen.findByRole('heading', { name: 'ㅎㅇ의 저장소' })
    expect(screen.queryByRole('textbox', { name: '프로젝트 이름' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '연결할 프로젝트' })).not.toBeInTheDocument()
  })
  it('새 프로젝트는 사이드바에서 별도로 시작하며 자동으로 생성하지 않는다', async () => {
    const { fetcher } = backend(); rememberProjectForUser('42', '2'); mount(); const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'ㅎㅇ의 저장소' })
    await user.click(screen.getByLabelText('프로젝트 전환'))
    await user.click(screen.getByRole('link', { name: '새 프로젝트 만들기' }))
    await screen.findByRole('textbox', { name: '프로젝트 이름' })
    expect(fetcher.mock.calls.some(([path]) => path === '/api/projects/2/repositories')).toBe(true)
    await waitFor(() => expect(screen.getByRole('heading', { name: '함께할 프로젝트를 준비해요' })).toBeInTheDocument())
    expect(screen.getByLabelText('프로젝트 시작일')).toBeInTheDocument()
    expect(screen.getByLabelText('프로젝트 종료일')).toBeInTheDocument()
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
  })
})
