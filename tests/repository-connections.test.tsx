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

function backend({ projects = [project], failure = '', expired = false, failedIds = [] as string[], paged = false, alreadyConnected = false } = {}) {
  let repositories: ConnectedRepository[] = alreadyConnected ? [connected] : []
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/github/authorization") return Response.json({ organizationAccessUrl: "https://github.com/settings/connections/applications/test-public-client" })
    if (path === '/api/projects' && init?.method === 'POST') {
      const created = { ...project, id: '2', name: JSON.parse(init.body as string).name as string }
      projects = [...projects, created]
      return Response.json(created, { status: 201 })
    }
    if (path === '/api/projects') return Response.json(projects)
    if (path.startsWith('/api/github/accounts')) return Response.json({ items: [{ id: '10', login: 'octocat', type: 'USER' }, { id: '20', login: 'team', type: 'ORGANIZATION' }], page: 1, hasNext: false })
    if (path.startsWith('/api/github/repositories')) {
      if (expired) return Response.json({ code: 'GITHUB_REAUTH_REQUIRED', message: 'GitHub에 다시 로그인해 주세요.' }, { status: 401 })
      const params = new URL(path, 'http://127.0.0.1').searchParams
      const scope = params.get('scope')
      const page = Number(params.get('page'))
      return Response.json({ items: paged ? page === 1 ? [source] : [personalSource] : scope === 'personal' ? [personalSource] : scope === 'organization' ? [source] : [source, personalSource], page, hasNext: paged && page === 1 })
    }
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-value' })
    if (path.endsWith('/repositories/40') && init?.method === 'DELETE') { repositories = []; return new Response(null, { status: 204 }) }
    if (path.endsWith('/repositories') && init?.method === 'POST') {
      const id = JSON.parse(init.body as string).githubRepositoryId as string
      if (failure || failedIds.includes(id)) return Response.json({ code: 'GITHUB_RESOURCE_NOT_FOUND', message: failure || '접근할 수 없는 저장소입니다.' }, { status: 404 })
      const item = id === '30' ? connected : { ...connected, id: '41', githubRepositoryId: id, owner: 'octocat', name: 'client', htmlUrl: 'https://github.com/octocat/client' }
      repositories = [...repositories, item]
      return Response.json(item, { status: 201 })
    }
    if (path.endsWith('/repositories')) return Response.json(repositories)
    if (path.endsWith('/issues/sync')) return Response.json({ collected: 0, skippedRepositories: 0, hasMore: false })
    if (path.endsWith('/pull-requests/sync')) return Response.json({ collected: 0, skippedRepositories: 0 })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}

function mount(url = '/settings?tab=repositories') { render(<MemoryRouter initialEntries={[url]}><RepositoryConnections project={project} /></MemoryRouter>) }

describe('사이트 안에서 GitHub 저장소 연결', () => {
  it('저장소 ID만 CSRF와 세션 쿠키로 연결하고 새로고침·해제를 처리한다', async () => {
    const fetcher = backend()
    mount()
    const user = userEvent.setup()
    const button = await screen.findByRole('button', { name: '선택한 저장소 연결' })
    await userEvent.setup().click(await screen.findByRole('checkbox', { name: 'team/server · 비공개' }))
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

  it('프로젝트 생성은 별도 시작 화면에서만 하고 만든 ID로 연결한다', async () => {
    const fetcher = backend({ projects: [] })
    render(<MemoryRouter initialEntries={['/onboarding?new=1']}><RepositoryConnections onboarding /></MemoryRouter>)
    const user = userEvent.setup()
    await user.type(screen.getByRole('textbox', { name: '프로젝트 이름' }), '새 협업 프로젝트')
    await user.click(await screen.findByRole('checkbox', { name: 'team/server · 비공개' }))
    await user.click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/projects/2/repositories', expect.objectContaining({ method: 'POST' })))
    expect(fetcher).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ body: JSON.stringify({ name: '새 협업 프로젝트' }) }))
  })

  it('개인·Organization 저장소를 사이트의 선택기로 조회한다', async () => {
    const fetcher = backend()
    mount()
    const user = userEvent.setup()
    await screen.findByRole('option', { name: 'team · Organization' })
    const account = screen.getByRole('combobox', { name: 'GitHub 계정 또는 Organization' })
    await user.selectOptions(account, 'personal')
    await screen.findByRole('checkbox', { name: 'octocat/client' })
    expect(fetcher).toHaveBeenCalledWith('/api/github/repositories?page=1&scope=personal', expect.anything())
    await user.selectOptions(account, 'organization:team')
    await screen.findByRole('checkbox', { name: 'team/server · 비공개' })
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
    await user.click(screen.getByRole('checkbox', { name: 'team/server · 비공개' }))
    expect(screen.getByRole('button', { name: '선택한 저장소 연결' })).toBeEnabled()
    expect(screen.queryByRole('checkbox', { name: 'octocat/client' })).not.toBeInTheDocument()
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
    await userEvent.setup().click(await screen.findByRole('checkbox', { name: 'team/server · 비공개' }))
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.setup().click(button)
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('접근할 수 없는 저장소입니다.')
    expect(screen.queryByRole('link', { name: 'team/server' })).not.toBeInTheDocument()
  })

  it('선택창으로 인한 focus 이벤트는 목록이나 선택을 초기화하지 않는다', async () => {
    const fetcher = backend()
    mount()
    await screen.findByRole('checkbox', { name: 'team/server · 비공개' })
    const count = fetcher.mock.calls.filter(([path]) => path.startsWith('/api/github/repositories')).length
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'team/server · 비공개' }))
    fireEvent(window, new Event('focus'))
    expect(fetcher.mock.calls.filter(([path]) => path.startsWith('/api/github/repositories')).length).toBe(count)
    expect(screen.getByRole('checkbox', { name: 'team/server · 비공개' })).toBeChecked()
  })

  it('조직 승인 화면으로 바로 연결하고 돌아오면 기존 목록 갱신 흐름을 사용한다', async () => {
    backend()
    mount()
    const approval = await screen.findByRole('link', { name: '조직 접근 승인하기' })
    expect(approval).toHaveAttribute('href', 'https://github.com/settings/connections/applications/test-public-client')
    expect(approval).toHaveAttribute('target', '_blank')
    await userEvent.setup().click(approval)
    expect(screen.getByRole('status')).toHaveTextContent('Grant')
  })

  it('가입 안내에서는 프로젝트 이름을 입력하지 않아도 저장소 선택으로 프로젝트를 준비한다', async () => {
    const fetcher = backend({ projects: [] })
    render(<MemoryRouter initialEntries={['/onboarding']}><RepositoryConnections onboarding /></MemoryRouter>)
    await screen.findByRole('checkbox', { name: 'team/server · 비공개' })
    expect(screen.queryByRole('button', { name: '프로젝트 만들기' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path, init]) => path === '/api/projects' && init?.method === 'POST')).toBe(false)
    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'team/server · 비공개' }))
    await userEvent.setup().click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/projects', expect.objectContaining({ body: JSON.stringify({ name: 'team' }) })))
    expect(fetcher).toHaveBeenCalledWith('/api/projects/2/repositories', expect.objectContaining({ method: 'POST' }))
  })

  it('조회 권한의 멤버에게 연결 변경 폼을 표시하지 않는다', async () => {
    backend()
    render(<MemoryRouter><RepositoryConnections project={{ ...project, role: 'VIEWER', canManageRepositories: false }} /></MemoryRouter>)
    await screen.findByText('프로젝트 소유자와 관리자만 저장소 연결을 변경할 수 있어요.')
    expect(screen.queryByRole('button', { name: '선택한 저장소 연결' })).not.toBeInTheDocument()
  })
  it('페이지와 계정이 달라도 고른 여러 저장소를 한 프로젝트에 연결하고 수집은 한 번만 한다', async () => {
    const fetcher = backend({ paged: true }); mount(); const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: 'team/server · 비공개' }))
    await user.click(screen.getByRole('button', { name: '다음 저장소' }))
    await user.click(await screen.findByRole('checkbox', { name: 'octocat/client' }))
    expect(screen.getByText(/2개 선택/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
    await screen.findByText('2개 저장소 연결 완료.')
    expect(screen.getByRole('link', { name: 'team/server' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'octocat/client' })).toBeInTheDocument()
    expect(fetcher.mock.calls.filter(([path, init]) => path === '/api/projects/1/repositories' && init?.method === 'POST')).toHaveLength(2)
    await waitFor(() => expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/issues/sync'))).toHaveLength(1))
    expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/pull-requests/sync'))).toHaveLength(1)
  })
  it('일부 연결이 실패하면 성공은 유지하고 실패한 저장소만 재시도한다', async () => {
    const failedIds = ['31']; const fetcher = backend({ failedIds }); mount(); const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: '현재 검색 결과 모두 선택' }))
    await user.click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
    await screen.findByText(/1개 저장소 연결 완료 · 1개 연결 실패/)
    expect(screen.getByRole('link', { name: 'team/server' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('octocat/client: 접근할 수 없는 저장소입니다.')
    expect(screen.getByRole('checkbox', { name: 'octocat/client' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'team/server · 비공개' })).toBeDisabled()
    failedIds.length = 0
    await user.click(screen.getByRole('button', { name: '선택한 저장소 연결' }))
    await screen.findByRole('link', { name: 'octocat/client' })
    const requests = fetcher.mock.calls.filter(([path, init]) => path.endsWith('/repositories') && init?.method === 'POST')
    expect(requests.map(([, init]) => JSON.parse(init!.body as string).githubRepositoryId)).toEqual(['30', '31', '31'])
  })
  it('현재 프로젝트 안에서는 다른 프로젝트 선택과 새 프로젝트 생성이 나타나지 않는다', async () => {
    const fetcher = backend({ alreadyConnected: true }); mount()
    await screen.findByRole('link', { name: 'team/server' })
    expect(screen.getByRole('checkbox', { name: 'team/server · 비공개' })).toBeDisabled()
    expect(screen.queryByRole('combobox', { name: '연결할 프로젝트' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '프로젝트 만들기' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path]) => path === '/api/projects')).toBe(false)
  })

})
