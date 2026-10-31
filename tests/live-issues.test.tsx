import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LiveIssues } from '../src/components/live-issues'
import type { LiveIssue, Project } from '../src/lib/project-api'

const project: Project = { id: '1', name: '팀 프로젝트', role: 'OWNER', description: null, canManageRepositories: true }
const issue: LiveIssue = { id: '20', version: 0, key: 'Z-unique', title: '로그인 개선', description: '작업 설명', status: 'TODO', source: 'DAILY', meetingDate: '2026-10-31', meetingContext: '회의 결정', acceptanceCriteria: '- [ ] 로그인 성공', priority: 'HIGH', assignee: null, repositoryId: '10', repositoryOwner: 'team', repositoryName: 'server', number: 0, url: '', githubState: null, publishStatus: 'LOCAL', lastPublishError: null, archived: false }
function backend({ viewer = false, conflict = false, saved = [] as LiveIssue[] } = {}) {
  let rows = [...saved]
  const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
    if (input === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'test-csrf' })
    if (input === '/api/projects/1/repositories') return Response.json([{ id: '10', owner: 'team', name: 'server', projectId: '1' }])
    if (input.includes('/assignees?')) return Response.json({ items: [{ login: 'team-member', id: 8 }], page: 1, hasNext: false })
    if (input === '/api/projects/1/issues' && init?.method === 'POST') { rows = [{ ...issue, ...JSON.parse(init.body as string).details }]; return Response.json(rows[0], { status: 201 }) }
    if (input === '/api/projects/1/issues/20' && init?.method === 'PATCH') {
      if (conflict) return Response.json({ code: 'ISSUE_CHANGED', message: '다른 변경이 있어요.' }, { status: 409 })
      rows = rows.map(row => ({ ...row, ...JSON.parse(init.body as string).details, version: row.version + 1 }))
      return Response.json(rows[0])
    }
    if (input === '/api/projects/1/issues/20/publish') { rows = rows.map(row => ({ ...row, publishStatus: 'PUBLISHED', number: 7, url: 'https://github.com/team/server/issues/7', githubState: 'OPEN', version: row.version + 1 })); return Response.json(rows[0]) }
    if (input.startsWith('/api/projects/1/issues/20?') && init?.method === 'DELETE') { rows = rows.map(row => ({ ...row, archived: true })); return new Response(null, { status: 204 }) }
    if (input === '/api/projects/1/issues/20') return Response.json(rows[0])
    if (input.startsWith('/api/projects/1/issues?')) {
      const params = new URL(input, 'http://local').searchParams
      const matches = rows.filter(row => row.archived === (params.get('archived') === 'true'))
      return Response.json({ items: matches, total: matches.length, page: 1, hasNext: false })
    }
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  const mount = () => render(<MemoryRouter><LiveIssues project={viewer ? { ...project, role: 'VIEWER' } : project} /></MemoryRouter>)
  return { fetcher, mount }
}

describe('실제 팀 작업', () => {
  it('서버에 먼저 저장하고 사용자가 선택한 뒤 GitHub에 발행한다', async () => {
    const { fetcher, mount } = backend(); mount()
    const user = userEvent.setup()
    await screen.findByText('아직 표시할 작업이 없어요')
    await user.click(screen.getByRole('button', { name: '새 작업 등록' }))
    const dialog = screen.getByRole('dialog', { name: '작업 상세' })
    await user.type(within(dialog).getByRole('textbox', { name: '작업 제목' }), '회의에서 정한 일')
    await user.type(within(dialog).getByRole('textbox', { name: '완료 조건' }), '사용자가 확인할 결과')
    await user.click(within(dialog).getByRole('button', { name: '작업 저장' }))
    await screen.findByRole('button', { name: '저장한 작업 GitHub에 발행' })
    expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/publish'))).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: '저장한 작업 GitHub에 발행' }))
    await screen.findByRole('link', { name: 'GitHub에서 보기' })
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/issues/20/publish', expect.objectContaining({ method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'test-csrf' }, body: JSON.stringify({ version: 0 }) }))
    expect(localStorage.getItem('accessToken')).toBeNull()
  })
  it('다른 변경과 충돌하면 입력을 보존하고 성공으로 표시하지 않는다', async () => {
    const { mount } = backend({ saved: [issue], conflict: true }); mount()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /로그인 개선/ }))
    const title = screen.getByRole('textbox', { name: '작업 제목' })
    await user.clear(title); await user.type(title, '내 수정 내용')
    await user.click(screen.getByRole('button', { name: '작업 저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 변경이 있어요.')
    expect(title).toHaveValue('내 수정 내용')
    expect(screen.queryByText('작업을 저장했어요.')).not.toBeInTheDocument()
  })
  it('보관을 확인한 뒤 서버에서 보관하고 원본 삭제는 요청하지 않는다', async () => {
    const { mount, fetcher } = backend({ saved: [issue] }); mount()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /로그인 개선/ }))
    await user.click(screen.getByRole('button', { name: '작업 보관', exact: true }))
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
    await user.click(screen.getByRole('button', { name: '보관하기', exact: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/issues/20?version=0', expect.objectContaining({ method: 'DELETE' }))
    await user.selectOptions(screen.getByRole('combobox', { name: '작업 목록' }), 'archived')
    await user.click(await screen.findByRole('button', { name: /로그인 개선/ }))
    expect(screen.getByRole('button', { name: '작업 복원' })).toBeInTheDocument()
  })
  it('조회 전용 멤버에게 쓰기 기능을 표시하지 않는다', async () => {
    const { mount } = backend({ saved: [issue], viewer: true }); mount()
    await userEvent.setup().click(await screen.findByRole('button', { name: /로그인 개선/ }))
    expect(screen.queryByRole('button', { name: '작업 저장' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '저장한 작업 GitHub에 발행' })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '작업 제목' })).toBeDisabled()
  })
  it('로그인 회원에게 프로젝트가 없으면 실제 연결 화면을 안내한다', () => {
    render(<MemoryRouter><LiveIssues project={null} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: '프로젝트와 저장소 연결' })).toHaveAttribute('href', '/onboarding')
    expect(screen.queryByText('로그인 개선')).not.toBeInTheDocument()
  })
})
