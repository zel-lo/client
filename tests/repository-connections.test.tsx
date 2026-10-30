import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { RepositoryConnections } from '../src/components/repository-connections'
import type { ConnectedRepository, Project } from '../src/lib/project-api'

const project: Project = { id: '1', name: '실제 프로젝트', description: null, role: 'OWNER', canManageRepositories: true }
const connected: ConnectedRepository = { id: '40', projectId: '1', githubRepositoryId: '30', installationId: '20', owner: 'team', name: 'server', htmlUrl: 'https://github.com/team/server', description: null, language: 'Java', defaultBranch: 'main', privateRepository: true, status: 'CONNECTED', initialSyncCompleted: false }

function backend({ projects = [project], installed = true, failure = '' }: { projects?: Project[]; installed?: boolean; failure?: string } = {}) {
  let repositories: ConnectedRepository[] = []
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/projects' && init?.method === 'POST') {
      const created = { ...project, id: '2', name: JSON.parse(init.body as string).name as string }
      projects = [...projects, created]
      return Response.json(created, { status: 201 })
    }
    if (path === '/api/projects') return Response.json(projects)
    if (path === '/api/github/config') return Response.json({ installUrl: 'https://github.com/apps/zello-dev/installations/new' })
    if (path.startsWith('/api/github/installations?')) return Response.json({ items: installed ? [{ id: '20', owner: 'team', ownerType: 'Organization' }] : [], hasNext: false, page: 1 })
    if (path.startsWith('/api/github/installations/20/repositories')) return Response.json({ items: [{ id: '30', fullName: 'team/server', privateRepository: true, archived: false }], hasNext: false, page: 1 })
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

function mount() { render(<MemoryRouter><RepositoryConnections /></MemoryRouter>) }

describe('실제 프로젝트 저장소 연결', () => {
  it('승인된 Organization 저장소를 CSRF와 세션 쿠키로 연결하고 서버 목록에서 복구한다', async () => {
    const fetcher = backend()
    mount()
    const user = userEvent.setup()
    const button = await screen.findByRole('button', { name: '선택한 저장소 연결' })
    await waitFor(() => expect(button).toBeEnabled())
    await user.click(button)
    const link = await screen.findByRole('link', { name: 'team/server' })
    expect(link).toHaveAttribute('href', 'https://github.com/team/server')
    expect(screen.getByText('접근 확인 완료 · 작업 데이터 수집 전')).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/repositories', expect.objectContaining({
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf-value' },
      body: JSON.stringify({ githubInstallationId: '20', githubRepositoryId: '30' }),
    }))
    await user.click(screen.getByRole('button', { name: '연결 목록 새로고침' }))
    await screen.findByRole('link', { name: 'team/server' })
    await user.click(screen.getByRole('button', { name: '연결 해제' }))
    await screen.findByText('저장소 연결을 해제했어요. GitHub 저장소는 유지됩니다.')
    expect(screen.queryByRole('link', { name: 'team/server' })).not.toBeInTheDocument()
    expect(localStorage.length).toBe(0)
  })

  it('프로젝트가 없으면 생성한 프로젝트 ID로 저장소 연결을 준비한다', async () => {
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

  it('GitHub 검증에 실패한 저장소를 연결 완료로 표시하지 않는다', async () => {
    backend({ failure: '접근할 수 없는 저장소입니다.' })
    mount()
    const button = await screen.findByRole('button', { name: '선택한 저장소 연결' })
    await waitFor(() => expect(button).toBeEnabled())
    await userEvent.setup().click(button)
    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('접근할 수 없는 저장소입니다.')
    expect(screen.queryByRole('link', { name: 'team/server' })).not.toBeInTheDocument()
  })

  it('설치가 없을 때 설치 링크와 새로고침을 제공하며 연결을 허용하지 않는다', async () => {
    backend({ installed: false })
    mount()
    await screen.findByText(/아직 연결된 GitHub 계정이 없어요/)
    const refresh = screen.getByRole('button', { name: '연결 목록 새로고침' })
    await waitFor(() => expect(refresh).toBeEnabled())
    await userEvent.setup().click(refresh)
    await waitFor(() => expect(refresh).toBeEnabled())
    expect(screen.getByRole('button', { name: '선택한 저장소 연결' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'GitHub 저장소 선택' })).toHaveAttribute('href', 'https://github.com/apps/zello-dev/installations/new')
  })

  it('GitHub에서 권한을 승인하고 돌아오면 계정과 저장소를 자동으로 갱신한다', async () => {
    backend({ installed: false })
    mount()
    await screen.findByText(/아직 연결된 GitHub 계정이 없어요/)
    backend({ installed: true })
    fireEvent(window, new Event('focus'))
    await screen.findByRole('option', { name: 'team · Organization' })
    await waitFor(() => expect(screen.getByRole('button', { name: '선택한 저장소 연결' })).toBeEnabled())
  })

  it('조회 권한의 멤버에게 연결 변경 폼을 표시하지 않는다', async () => {
    backend({ projects: [{ ...project, role: 'VIEWER', canManageRepositories: false }] })
    mount()
    await screen.findByText('프로젝트 소유자와 관리자만 저장소 연결을 변경할 수 있어요.')
    expect(screen.queryByRole('button', { name: '선택한 저장소 연결' })).not.toBeInTheDocument()
  })
})
