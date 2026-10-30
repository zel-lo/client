import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryConnections } from '../src/components/repository-connections'
import type { ConnectedRepository, Project } from '../src/lib/project-api'

const project: Project = { id: '1', name: '실제 프로젝트', description: null, role: 'OWNER', canManageRepositories: true }
const connected: ConnectedRepository = { id: '40', projectId: '1', githubRepositoryId: '30', installationId: null, owner: 'team', name: 'server', htmlUrl: 'https://github.com/team/server', description: null, language: 'Java', defaultBranch: 'main', privateRepository: true, status: 'CONNECTED', initialSyncCompleted: false }
const source = { id: '30', fullName: 'team/server', owner: 'team', ownerType: 'Organization', privateRepository: true, archived: false }
const personalSource = { ...source, id: '31', fullName: 'octocat/client', owner: 'octocat', ownerType: 'User', privateRepository: false }

function backend({ projects = [project], failure = '', expired = false }: { projects?: Project[]; failure?: string; expired?: boolean } = {}) {
  let repositories: ConnectedRepository[] = []
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/projects' && init?.method === 'POST') {
      const created = { ...project, id: '2', name: JSON.parse(init.body as string).name as string }
      projects = [...projects, created]
      return Response.json(created, { status: 201 })
    }
    if (path === '/api/projects') return Response.json(projects)
    if (path.startsWith('/api/github/accounts')) return Response.json({ items: [{ id: '10', login: 'octocat', type: 'USER' }, { id: '20', login: 'team', type: 'ORGANIZATION' }], page: 1, hasNext: false })
    if (path.startsWith('/api/github/repositories')) {
      if (expired) return Response.json({ code: 'GITHUB_REAUTH_REQUIRED', message: 'GitHub에 다시 로그인해 주세요.' }, { status: 401 })
      const scope = new URL(path, 'http://127.0.0.1').searchParams.get('scope')
      return Response.json({ items: scope === 'personal' ? [personalSource] : scope === 'organization' ? [source] : [source, personalSource], page: 1, hasNext: false })
    }
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-value' })
    if (path.endsWith('/repositories/40') && init?.method === 'DELETE') { repositories = []; return new Response(null, { status: 204 }) }
    if (path.endsWith('/repositories') && init?.method === 'POST') {
      if (failure) return Response.json({ code: 'GITHUB_RESOURCE_NOT_FOUND', message: failure }, { status: 404 })
      repositories = [connected]
      return Response.json(connected, { status: 201 })
    }
    if (path.endsWith('/repositories')) return Response.json(repositories)
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

function mount(url = '/settings?tab=repositories') { render(<MemoryRouter initialEntries={[url]}><RepositoryConnections /></MemoryRouter>) }

describe('사이트 안에서 GitHub 저장소 연결', () => {
  it('저장소 ID만 CSRF와 세션 쿠키로 연결하고 새로고침·해제를 처리한다', async () => {
    const fetcher = backend()
    mount()
    const user = userEvent.setup()
    const button = await screen.findByRole('button', { name: '선택한 저장소 연결' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    expect(await screen.findByRole('link', { name: 'team/server' })).toHaveAttribute('href', 'https://github.com/team/server')
    expect(screen.getByText('연결 완료 · 작업 데이터 수집 전')).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/repositories', expect.objectContaining({
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf-value' },
      body: JSON.stringify({ githubRepositoryId: '30' }),
    }))
    await user.click(screen.getByRole('button', { name: '목록 새로고침' }))
    await screen.findByRole('link', { name: 'team/server' })
    await user.click(screen.getByRole('button', { name: '연결 해제' }))
    await screen.findByText('저장소 연결을 해제했어요. GitHub 저장소는 유지됩니다.')
    expect(screen.queryByRole('link', { name: 'team/server' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.every(([path]) => !path.includes('/installations'))).toBe(true)
    expect(localStorage.length).toBe(0)
  })

  it('프로젝트가 없으면 만든 프로젝트 ID로 저장소를 연결한다', async () => {
    const fetcher = backend({ projects: [] })
    mount()
    const user = userEvent.setup()
    const input = screen.getByRole('textbox', { name: '새 프로젝트 이름' })
    await waitFor(() => expect(input).toBeEnabled())
    await user.type(input, '새 협업 프로젝트')
    await user.click(screen.getByRole('button', { name: '프로젝트 만들기' }))
    await screen.findByRole('heading', { name: '새 협업 프로젝트에 연결된 저장소' })
    const button = screen.getByRole('button', { name: '선택한 저장소 연결' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/projects/2/repositories', expect.objectContaining({ method: 'POST' })))
  })

  it('개인·Organization 저장소를 사이트의 선택기로 조회한다', async () => {
    const fetcher = backend()
    mount()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'team · Organization' })
    const account = screen.getByRole('combobox', { name: 'GitHub 계정 또는 Organization' })
    await user.selectOptions(account, 'personal')
    await screen.findByRole('option', { name: 'octocat/client' })
    expect(fetcher).toHaveBeenCalledWith('/api/github/repositories?page=1&scope=personal', expect.anything())
    await user.selectOptions(account, 'organization:team')
    await screen.findByRole('option', { name: 'team/server · 비공개' })
    expect(fetcher).toHaveBeenCalledWith('/api/github/repositories?page=1&scope=organization&organization=team', expect.anything())
    expect(screen.queryByRole('button', { name: /GitHub 연결|권한 변경/ })).not.toBeInTheDocument()
  })

  it('승인된 목록을 검색하고 검색 결과가 없으면 연결하지 않는다', async () => {
    backend()
    mount()
    const user = userEvent.setup()
    const search = await screen.findByRole('searchbox', { name: '목록에서 저장소 검색' })
    await waitFor(() => expect(search).toBeEnabled())
    await user.type(search, '없는-저장소')
    expect(screen.getByRole('button', { name: '선택한 저장소 연결' })).toBeDisabled()
    await user.clear(search)
    await user.type(search, 'server')
    expect(screen.getByRole('button', { name: '선택한 저장소 연결' })).toBeEnabled()
    expect(screen.queryByRole('option', { name: 'octocat/client' })).not.toBeInTheDocument()
  })

  it('검증 실패를 연결 완료로 표시하지 않고 재로그인이 필요하면 로그인으로 안내한다', async () => {
    backend({ expired: true })
    mount()
    await screen.findByRole('alert')
    expect(screen.getByRole('link', { name: 'GitHub 다시 로그인' })).toHaveAttribute('href', '/login?reauth=github')
    expect(screen.getByRole('button', { name: '선택한 저장소 연결' })).toBeDisabled()
  })

  it('GitHub 접근이 취소된 저장소를 로컬 목록에 추가하지 않는다', async () => {
    backend({ failure: '접근할 수 없는 저장소입니다.' })
    mount()
    const button = await screen.findByRole('button', { name: '선택한 저장소 연결' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.setup().click(button)
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('접근할 수 없는 저장소입니다.')
    expect(screen.queryByRole('link', { name: 'team/server' })).not.toBeInTheDocument()
  })

  it('탭을 다시 활성화하면 사용자 토큰으로 목록을 갱신한다', async () => {
    const fetcher = backend()
    mount()
    await screen.findByRole('option', { name: 'team/server · 비공개' })
    const count = fetcher.mock.calls.filter(([path]) => path.startsWith('/api/github/repositories')).length
    fireEvent(window, new Event('focus'))
    await waitFor(() => expect(fetcher.mock.calls.filter(([path]) => path.startsWith('/api/github/repositories')).length).toBeGreaterThan(count))
  })

  it('조회 권한의 멤버에게 연결 변경 폼을 표시하지 않는다', async () => {
    backend({ projects: [{ ...project, role: 'VIEWER', canManageRepositories: false }] })
    mount()
    await screen.findByText('프로젝트 소유자와 관리자만 저장소 연결을 변경할 수 있어요.')
    expect(screen.queryByRole('button', { name: '선택한 저장소 연결' })).not.toBeInTheDocument()
  })
})
