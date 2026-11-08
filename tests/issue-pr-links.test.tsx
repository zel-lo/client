import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CreateLivePullRequest } from '../src/components/create-live-pull-request'
import { IssuePicker, IssuePullRequestLinks, PullRequestIssueLinks } from '../src/components/issue-pr-links'
import type { LiveIssue } from '../src/lib/project-api'

const issue: LiveIssue = { id: '12', key: 'ZELLO-12', title: '검색 개선', repositoryId: '40', repositoryOwner: 'team', repositoryName: 'server', version: 4,
  number: 23, url: 'https://github.com/team/server/issues/23', githubState: 'OPEN', archived: false, publishStatus: 'PUBLISHED', lastPublishError: null,
  description: '', acceptanceCriteria: '', status: 'TODO', priority: 'MEDIUM', source: 'REQUEST', meetingDate: null, meetingContext: '', assignee: null }
const pull = { id: '3', number: 30, repositoryId: '40', title: '검색 PR', state: 'OPEN', draft: false, reviewDecision: 'PENDING', url: 'https://github.com/team/server/pull/30' }
function backend() {
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF', token: 'csrf' })
    if (path.endsWith('/issues/12')) return Response.json(issue)
    if (path.includes('/issues/12/pull-requests/3')) return Response.json({ ...issue, version: 5, status: init?.method === 'DELETE' ? 'TODO' : 'IN_REVIEW', pullRequests: init?.method === 'DELETE' ? [] : [pull] })
    if (path.includes('/issues?')) {
      const params = new URLSearchParams(path.split('?')[1])
      return Response.json({ items: params.get('page') === '2' ? [{ ...issue, id: '13', key: 'ZELLO-13', title: '두 번째 작업' }] : [issue], page: Number(params.get('page') ?? 1), hasNext: params.get('page') !== '2', total: 2 })
    }
    if (path.endsWith('/repositories')) return Response.json([{ id: '40', owner: 'team', name: 'server' }])
    if (path.endsWith('/branches')) return Response.json({ branches: ['main', 'feat/search'], defaultBranch: 'main', hasMore: false })
    if (path.endsWith('/reviewer-candidates')) return Response.json({ users: [], hasMore: false })
    if (path.includes('/pull-requests?')) return Response.json({ items: [pull], hasNext: false, total: 1, page: 1 })
    if (path.endsWith('/pull-requests') && init?.method === 'POST') return Response.json(pull, { status: 201 })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const mount = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>)

describe('이슈와 PR 연결', () => {
  it('작업에서 PR을 작성하면 저장소·제목·이슈를 미리 채우고 선택한 ID를 보낸다', async () => {
    const fetcher = backend(), created = vi.fn(), control = userEvent.setup()
    mount(<CreateLivePullRequest projectId="7" initialIssue={issue} onCancel={() => {}} onCreated={created} />)
    expect(screen.getByLabelText('검토 요청 제목')).toHaveValue('검색 개선')
    expect(await screen.findByRole('checkbox', { name: /검색 개선/ })).toBeChecked()
    await control.selectOptions(screen.getByLabelText('작업 브랜치'), 'feat/search')
    await control.type(screen.getByLabelText('팀에 전할 변경 요약'), '검색을 빠르게 했어요')
    await control.click(screen.getByRole('button', { name: '검토 요청 만들기' }))
    await waitFor(() => expect(created).toHaveBeenCalled())
    const sent = fetcher.mock.calls.find(([path, init]) => path.endsWith('/pull-requests') && init?.method === 'POST')!
    expect(JSON.parse(sent[1]!.body as string)).toMatchObject({ repositoryId: '40', title: '검색 개선', issueIds: ['12'] })
  })

  it('기존 PR을 연결할 때 같은 저장소를 조회하고 작업 version과 CSRF를 전송한다', async () => {
    const fetcher = backend(), changed = vi.fn(), busy = vi.fn(), control = userEvent.setup()
    mount(<IssuePullRequestLinks projectId="7" issue={issue} canWrite disabled={false} onBusyChange={busy} onChanged={changed} />)
    await control.click(screen.getByRole('button', { name: '기존 검토 요청 연결' }))
    await screen.findByRole('option', { name: '#30 · 검색 PR' })
    await control.selectOptions(screen.getByLabelText('연결할 PR'), '3')
    await control.click(screen.getByRole('button', { name: '선택한 PR 연결' }))
    await waitFor(() => expect(changed).toHaveBeenCalledWith(expect.objectContaining({ status: 'IN_REVIEW', version: 5 })))
    expect(fetcher.mock.calls.some(([path]) => path.includes('repositoryId=40'))).toBe(true)
    expect(fetcher).toHaveBeenCalledWith('/api/projects/7/issues/12/pull-requests/3?version=4', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'X-CSRF': 'csrf' }) }))
    expect(busy).toHaveBeenLastCalledWith(false)
  })

  it('PR 상세에서 이슈 연결을 해제하고 실제 이슈 상세로 이동할 수 있다', async () => {
    const fetcher = backend(), changed = vi.fn(), control = userEvent.setup()
    mount(<PullRequestIssueLinks projectId="7" pullId="3" repositoryId="40" links={[{ id: issue.id, key: issue.key, number: issue.number, title: issue.title, url: issue.url, status: issue.status, archived: false }]} canWrite onChanged={changed} />)
    expect(screen.getByRole('link', { name: /ZELLO-12/ })).toHaveAttribute('href', '/issues?issue=12')
    await control.click(screen.getByRole('button', { name: '연결 해제' }))
    await waitFor(() => expect(changed).toHaveBeenCalled())
    expect(fetcher).toHaveBeenCalledWith('/api/projects/7/issues/12/pull-requests/3?version=4', expect.objectContaining({ method: 'DELETE' }))
  })

  it('조회 전용 멤버는 양쪽 연결 화면에서 수정 버튼을 볼 수 없다', () => {
    mount(<><IssuePullRequestLinks projectId="7" issue={{ ...issue, pullRequests: [pull] as LiveIssue['pullRequests'] }} canWrite={false} disabled onBusyChange={() => {}} onChanged={() => {}} />
      <PullRequestIssueLinks projectId="7" pullId="3" repositoryId="40" links={[]} canWrite={false} onChanged={() => {}} /></>)
    expect(screen.queryByRole('button', { name: /연결/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /검색 PR/ })).toHaveAttribute('href', '/pull-requests?pr=3')
  })

  it('이슈를 여러 페이지에서 선택해도 앞에서 고른 작업을 유지한다', async () => {
    backend()
    const changed = vi.fn(), control = userEvent.setup()
    const view = mount(<IssuePicker projectId="7" repositoryId="40" selected={['12']} onChange={changed} />)
    await screen.findByRole('checkbox', { name: /검색 개선/ })
    await control.click(screen.getByRole('button', { name: '다음 이슈' }))
    await control.click(await screen.findByRole('checkbox', { name: /두 번째 작업/ }))
    expect(changed).toHaveBeenCalledWith(['12', '13'])
    view.unmount()
  })
})
