import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { IssueWorkBranchPanel } from '../src/components/issue-work-branch'
import { CreateLivePullRequest } from '../src/components/create-live-pull-request'
import type { IssueWorkBranch, LiveIssue } from '../src/lib/project-api'

const issue: LiveIssue = { id: '12', key: 'ZELLO-12', title: '검색 개선', repositoryId: '40', repositoryOwner: 'team', repositoryName: 'server', version: 4,
  number: 23, url: 'https://github.com/team/server/issues/23', githubState: 'OPEN', archived: false, publishStatus: 'PUBLISHED', lastPublishError: null,
  description: '', acceptanceCriteria: '', status: 'TODO', priority: 'MEDIUM', source: 'REQUEST', meetingDate: null, meetingContext: '', assignee: null }
function branch(ready: boolean): IssueWorkBranch {
  return { repository: 'team/server', name: 'feat/23', baseBranch: 'main', url: 'https://github.com/team/server/tree/feat/23',
    commands: 'git fetch origin\ngit switch feat/23', ready, created: ready, issue: ready ? { ...issue, workBranch: 'feat/23', workBranchBase: 'main', status: 'IN_PROGRESS', version: 5 } : issue }
}
function backend({ ready = false, failure = false } = {}) {
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF', token: 'csrf' })
    if (path.endsWith('/branch') && init?.method === 'POST') return failure ? Response.json({ code: 'GITHUB_BRANCH_RESULT_UNKNOWN', message: '브랜치를 다시 확인해 주세요.' }, { status: 503 }) : Response.json(branch(true))
    if (path.endsWith('/branch')) return Response.json(branch(ready))
    if (path.endsWith('/repositories')) return Response.json([{ id: '40', owner: 'team', name: 'server' }])
    if (path.endsWith('/branches')) return Response.json({ branches: ['main', 'feat/23', 'feat/other'], defaultBranch: 'main', hasMore: false })
    if (path.endsWith('/reviewer-candidates')) return Response.json({ users: [], hasMore: false })
    if (path.includes('/issues?')) return Response.json({ items: [issue], page: 1, hasNext: false, total: 1 })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
function mount(value = issue, canWrite = true, disabled = false) {
  const changed = vi.fn(), busy = vi.fn()
  render(<IssueWorkBranchPanel projectId="7" issue={value} canWrite={canWrite} disabled={disabled} onBusyChange={busy} onChanged={changed} />)
  return { changed, busy }
}

describe('작업 브랜치', () => {
  it('조회만으로 생성하지 않고 작업 시작 후 Git 명령어를 복사한다', async () => {
    const fetcher = backend(), control = userEvent.setup()
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const { changed, busy } = mount()
    expect(await screen.findByText('feat/23')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Git 명령어 복사' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false)
    await control.click(screen.getByRole('button', { name: '작업 시작' }))
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_PROGRESS', workBranch: 'feat/23', version: 5 })))
    expect(fetcher).toHaveBeenCalledWith('/api/projects/7/issues/12/branch', expect.objectContaining({ method: 'POST', body: JSON.stringify({ version: 4 }), headers: expect.objectContaining({ 'X-CSRF': 'csrf' }) }))
    await control.click(screen.getByRole('button', { name: 'Git 명령어 복사' }))
    expect(copy).toHaveBeenCalledWith('git fetch origin\ngit switch feat/23')
    expect(screen.getByRole('link', { name: 'GitHub에서 브랜치 보기' })).toHaveAttribute('href', 'https://github.com/team/server/tree/feat/23')
    expect(busy).toHaveBeenLastCalledWith(false)
  })
  it('실패하면 진행 중으로 바꾸거나 성공 명령어를 표시하지 않는다', async () => {
    backend({ failure: true }); const { changed } = mount()
    await userEvent.setup().click(await screen.findByRole('button', { name: '작업 시작' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('브랜치를 다시 확인해 주세요.')
    expect(changed).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Git 명령어 복사' })).not.toBeInTheDocument()
  })
  it('로컬 작업에는 GitHub 발행을 안내한다', () => {
    const fetcher = backend(); mount({ ...issue, publishStatus: 'LOCAL', number: 0 })
    expect(screen.getByText(/GitHub에 이슈를 발행하면/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '작업 시작' })).not.toBeInTheDocument()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('조회 전용 멤버는 기존 명령어를 볼 수 있지만 브랜치를 만들 수 없다', async () => {
    backend({ ready: true }); mount({ ...issue, workBranch: 'feat/23' }, false)
    expect(await screen.findByRole('button', { name: 'Git 명령어 복사' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /작업 시작|작업 브랜치 확인/ })).not.toBeInTheDocument()
  })
  it('저장하지 않은 수정이 있으면 작업 시작을 막는다', async () => {
    backend(); mount(issue, true, true)
    await screen.findByText('feat/23')
    expect(screen.getByRole('button', { name: '작업 시작' })).toBeDisabled()
  })
  it('브랜치가 저장된 이슈에서 PR을 작성하면 작업 브랜치를 자동 선택한다', async () => {
    backend()
    render(<MemoryRouter><CreateLivePullRequest projectId="7" initialIssue={{ ...issue, workBranch: 'feat/23' }} onCreated={() => {}} onCancel={() => {}} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByLabelText('작업 브랜치')).toHaveValue('feat/23'))
    expect(screen.getByLabelText('PR 제목')).toHaveValue('검색 개선')
    expect(await screen.findByRole('checkbox', { name: /검색 개선/ })).toBeChecked()
  })
})
