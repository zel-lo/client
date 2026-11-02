import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LiveIssues } from '../src/components/live-issues'
import type { LiveIssue, Project } from '../src/lib/project-api'

const project: Project = { id: '1', name: '팀 프로젝트', role: 'OWNER', description: null, canManageRepositories: true }
const issue: LiveIssue = { id: '20', version: 0, key: 'Z-unique', title: '로그인 개선', description: '작업 설명', status: 'TODO', source: 'DAILY', meetingDate: '2026-10-31', meetingContext: '회의 결정', acceptanceCriteria: '- [ ] 로그인 성공', priority: 'HIGH', assignee: null, repositoryId: '10', repositoryOwner: 'team', repositoryName: 'server', number: 0, url: '', githubState: null, publishStatus: 'LOCAL', lastPublishError: null, archived: false }
function backend({ viewer = false, conflict = false, saved = [] as LiveIssue[], failPublish = false } = {}) {
  let rows = [...saved]
  let publishAttempts = 0
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
    if (input === '/api/projects/1/issues/20/publish') {
      if (failPublish && publishAttempts++ === 0) { rows = rows.map(row => ({ ...row, publishStatus: 'FAILED', lastPublishError: '저장소의 이슈 권한을 확인해 주세요.', version: row.version + 1 })); return Response.json({ code: 'GITHUB_ACCESS_RESTRICTED', message: '저장소의 이슈 권한을 확인해 주세요.' }, { status: 403 }) }
      rows = rows.map(row => ({ ...row, publishStatus: 'PUBLISHED', number: 7, url: 'https://github.com/team/server/issues/7', githubState: 'OPEN', version: row.version + 1 })); return Response.json(rows[0]) }
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
  const notify = vi.fn()
  const mount = () => render(<MemoryRouter><LiveIssues project={viewer ? { ...project, role: 'VIEWER' } : project} onNotify={notify} /></MemoryRouter>)
  return { fetcher, mount, notify }
}

describe('실제 팀 작업', () => {
  it('서버에 먼저 저장하고 창을 닫은 뒤, 사용자가 카드에서 GitHub에 발행한다', async () => {
    const { fetcher, mount, notify } = backend(); mount()
    const user = userEvent.setup()
    await screen.findByText('아직 표시할 작업이 없어요')
    await user.click(screen.getByRole('button', { name: '새 작업 등록' }))
    const dialog = screen.getByRole('dialog', { name: '새 작업 등록' })
    await user.type(within(dialog).getByRole('textbox', { name: '작업 제목' }), '회의에서 정한 일')
    await user.type(within(dialog).getByRole('textbox', { name: '완료 조건' }), '사용자가 확인할 결과')
    await user.click(within(dialog).getByRole('checkbox', { name: /저장하고 GitHub에도 이슈 만들기/ }))
    await user.click(within(dialog).getByRole('button', { name: 'zello에만 저장' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Z-unique을 zello에 등록했어요. GitHub에는 아직 만들지 않았어요.'))
    expect(screen.queryByRole('dialog', { name: '새 작업 등록' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/publish'))).toHaveLength(0)
    await user.click(await screen.findByRole('button', { name: /회의에서 정한 일/ }))
    await user.click(screen.getByRole('button', { name: '저장한 작업 GitHub에 발행' }))
    await screen.findByRole('link', { name: 'GitHub에서 보기' })
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/issues/20/publish', expect.objectContaining({ method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'test-csrf' }, body: JSON.stringify({ version: 0 }) }))
    expect(localStorage.getItem('accessToken')).toBeNull()
  })
  it('작업의 설명과 완료 조건을 각각 미리 보고 마크다운 원문으로 저장한다', async () => {
    const { fetcher, mount } = backend(); mount()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '새 작업 등록' }))
    const dialog = screen.getByRole('dialog', { name: '새 작업 등록' })
    await user.type(within(dialog).getByRole('textbox', { name: '작업 제목' }), '미리 볼 작업')
    const description = '## 작업 배경\n**빠른 검색**과 `응답 시간`을 확인해요.'
    const criteria = '- [x] 목록 표시\n- [ ] 검색 결과 확인'
    const descriptionInput = within(dialog).getByRole('textbox', { name: '설명' })
    const criteriaInput = within(dialog).getByRole('textbox', { name: '완료 조건' })
    const descriptionEditor = within(descriptionInput.closest('.markdown-editor') as HTMLElement)
    const criteriaEditor = within(criteriaInput.closest('.markdown-editor') as HTMLElement)
    await user.click(descriptionInput); await user.paste(description)
    await user.click(criteriaInput); await user.paste(criteria)
    await user.click(descriptionEditor.getByRole('tab', { name: '미리보기' }))
    expect(descriptionEditor.getByRole('heading', { name: '작업 배경' })).toBeInTheDocument()
    expect(descriptionEditor.getByText('빠른 검색').tagName).toBe('STRONG')
    expect(criteriaInput).toBeVisible()
    await user.click(descriptionEditor.getByRole('tab', { name: '작성' }))
    expect(descriptionInput).toHaveValue(description)
    await user.click(descriptionEditor.getByRole('tab', { name: '미리보기' }))
    await user.click(criteriaEditor.getByRole('tab', { name: '미리보기' }))
    expect(criteriaEditor.getAllByRole('checkbox')[0]).toBeChecked()
    expect(criteriaEditor.getAllByRole('checkbox')[1]).not.toBeChecked()
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    await user.click(within(dialog).getByRole('checkbox', { name: /저장하고 GitHub에도 이슈 만들기/ }))
    await user.click(within(dialog).getByRole('button', { name: 'zello에만 저장' }))
    await waitFor(() => expect(fetcher.mock.calls.some(([path, init]) => path === '/api/projects/1/issues' && init?.method === 'POST')).toBe(true))
    const sent = fetcher.mock.calls.find(([path, init]) => path === '/api/projects/1/issues' && init?.method === 'POST')!
    expect(JSON.parse(sent[1]!.body as string).details).toMatchObject({ description, acceptanceCriteria: criteria })
    expect(fetcher.mock.calls.some(([path]) => path.endsWith('/publish'))).toBe(false)
  })

  it('조회 전용 작업에서도 설명·완료 조건·회의 내용의 마크다운을 미리 볼 수 있다', async () => {
    const { fetcher, mount } = backend({ viewer: true, saved: [{ ...issue, description: '**기존 설명**', acceptanceCriteria: '- [x] 확인 완료', meetingContext: '## 회의 결정\n기존 동작을 유지해요.' }] }); mount()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /로그인 개선/ }))
    for (const label of ['설명', '완료 조건', '회의에서 정한 내용']) {
      const input = screen.getByRole('textbox', { name: label })
      expect(input).toBeDisabled()
      await user.click(within(input.closest('.markdown-editor') as HTMLElement).getByRole('tab', { name: '미리보기' }))
    }
    expect(screen.getByText('기존 설명').tagName).toBe('STRONG')
    expect(screen.getByRole('checkbox', { name: '' })).toBeChecked()
    expect(screen.getByRole('heading', { name: '회의 결정' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '작업 저장' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST' || init?.method === 'PATCH')).toBe(false)
  })

  it('기본 생성은 로컬 저장 성공 후 최신 버전으로 GitHub 발행까지 하고 창을 닫는다', async () => {
    const { fetcher, mount, notify } = backend(); mount(); const user = userEvent.setup()
    await screen.findByText('아직 표시할 작업이 없어요')
    await user.click(screen.getByRole('button', { name: '새 작업 등록' }))
    expect(screen.getByRole('checkbox', { name: /저장하고 GitHub에도 이슈 만들기/ })).toBeChecked()
    await user.type(screen.getByRole('textbox', { name: '작업 제목' }), 'GitHub 실제 이슈')
    await user.click(screen.getByRole('button', { name: '저장하고 GitHub에 만들기' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Z-unique을 등록하고 GitHub 이슈도 만들었어요.'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /GitHub 실제 이슈/ })).toBeInTheDocument()
    const writes = fetcher.mock.calls.filter(([path, init]) => init?.method === 'POST' && path !== '/api/auth/csrf')
    expect(writes.map(([path]) => path)).toEqual(['/api/projects/1/issues', '/api/projects/1/issues/20/publish'])
    expect(JSON.parse(writes[1][1]!.body as string)).toEqual({ version: 0 })
  })
  it('GitHub 생성 실패는 로컬 작업을 보존해 토스트로 알리고, 카드에서 같은 작업을 다시 발행한다', async () => {
    const { fetcher, mount, notify } = backend({ failPublish: true }); mount(); const user = userEvent.setup()
    await screen.findByText('아직 표시할 작업이 없어요')
    await user.click(screen.getByRole('button', { name: '새 작업 등록' }))
    await user.type(screen.getByRole('textbox', { name: '작업 제목' }), '보존할 작업')
    await user.click(screen.getByRole('button', { name: '저장하고 GitHub에 만들기' }))
    await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringContaining('저장소의 이슈 권한을 확인해 주세요.'), 'error'))
    expect(screen.queryByRole('dialog', { name: '새 작업 등록' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /보존할 작업/ }))
    await user.click(screen.getByRole('button', { name: '저장한 작업 GitHub에 발행' }))
    await screen.findByRole('link', { name: 'GitHub에서 보기' })
    expect(fetcher.mock.calls.filter(([path, init]) => path === '/api/projects/1/issues' && init?.method === 'POST')).toHaveLength(1)
    expect(fetcher.mock.calls.filter(([path]) => path.endsWith('/publish')).map(([, init]) => JSON.parse(init!.body as string).version)).toEqual([0, 1])
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
