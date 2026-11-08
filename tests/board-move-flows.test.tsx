import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LiveIssues } from '../src/components/live-issues'
import { TeamBoard } from '../src/components/team-board'
import { startOfWeek } from '../src/lib/work-weeks'
import type { LinkedPullRequest, LiveIssue, PullRequestItem } from '../src/lib/project-api'

const project = { id: '1', name: '팀', description: null, role: 'OWNER', canManageRepositories: true }
const week = startOfWeek()
const seed: LiveIssue = { id: '20', version: 2, key: 'ZELLO-20', title: '검색 응답 개선', description: '', status: 'TODO', priority: 'MEDIUM', source: 'REQUEST', meetingDate: null, meetingContext: '', acceptanceCriteria: '', assignee: 'me', repositoryId: '10', repositoryOwner: 'team', repositoryName: 'server', number: 23, url: 'https://github.com/team/server/issues/23', githubState: 'OPEN', archived: false, publishStatus: 'PUBLISHED', lastPublishError: null, plannedWeekStart: week, boardOrder: 0, completedAt: null, pullRequests: [] }
function pull(id: string, number: number, headBranch: string, draft = false): PullRequestItem {
  return { id, repositoryId: '10', repositoryOwner: 'team', repositoryName: 'server', number, url: `https://github.com/team/server/pull/${number}`, title: `PR ${number}`, headBranch, baseBranch: 'main', state: 'OPEN', draft, reviewDecision: 'PENDING', teamSummary: null, author: null, reviewers: [], version: 1, changedFiles: null, additions: null, deletions: null, openedAt: null, mergedAt: null, githubUpdatedAt: null }
}
const linked = (item: PullRequestItem): LinkedPullRequest => ({ id: item.id, number: item.number, title: item.title, url: item.url, state: item.state, draft: item.draft, reviewDecision: item.reviewDecision })

function setup(initial: Partial<LiveIssue> = {}, pulls: PullRequestItem[] = []) {
  let row: LiveIssue = { ...seed, ...initial }
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (path.includes('/assignees?')) return Response.json({ items: [{ login: 'me' }], hasNext: false })
    if (path.endsWith('/repositories')) return Response.json([{ id: '10', name: 'server', owner: 'team' }])
    if (path === '/api/projects/1/issues/20/branch' && init?.method === 'POST') {
      row = { ...row, status: 'IN_PROGRESS', workBranch: 'feat/23', workBranchBase: 'main', version: row.version + 1 }
      return Response.json({ repository: 'team/server', name: 'feat/23', baseBranch: 'main', url: 'https://github.com/team/server/tree/feat/23', commands: 'git fetch origin\ngit switch feat/23', ready: true, created: true, issue: row })
    }
    const link = path.match(/^\/api\/projects\/1\/issues\/20\/pull-requests\/(\w+)\?version=(\d+)$/)
    if (link && init?.method === 'POST') {
      const chosen = pulls.find(item => item.id === link[1])!
      row = { ...row, status: chosen.draft ? 'IN_PROGRESS' : 'IN_REVIEW', version: row.version + 1, pullRequests: [...(row.pullRequests ?? []), linked(chosen)] }
      return Response.json(row)
    }
    if (path === '/api/projects/1/issues/20' && init?.method === 'PATCH') {
      const body = JSON.parse(init.body as string)
      row = { ...row, ...body.details, version: row.version + 1 }
      return Response.json(row)
    }
    if (path === '/api/projects/1/issues/20') return Response.json(row)
    if (path.includes('/issues?')) return Response.json({ items: [row], total: 1, page: 1, hasNext: false })
    if (path.includes('/pull-requests?')) return Response.json({ items: pulls, total: pulls.length, page: 1, hasNext: false, counts: { open: pulls.length, merged: 0, closed: 0 } })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter><LiveIssues project={project} /></MemoryRouter>)
  return fetcher
}
const column = (name: string) => within(screen.getByRole('region', { name: `${name} 열` }))
async function moveWithMenu(target: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'ZELLO-20 작업 메뉴' }))
  await user.click(screen.getByRole('menuitem', { name: `${target} 이동` }))
  return user
}

describe('보드 단계 이동과 GitHub 작업', () => {
  it.each(['LOCAL', 'PUBLISHED'] as const)('%s 작업은 팀에 알릴 변경 제목을 작성한 뒤 완료한다', async publishStatus => {
    const fetcher = setup({ status: 'IN_PROGRESS', publishStatus })
    const user = await moveWithMenu('완료로')
    const dialog = screen.getByRole('dialog', { name: '작업을 완료할까요?' })
    const save = within(dialog).getByRole('button', { name: publishStatus === 'PUBLISHED' ? '완료하고 GitHub 이슈 닫기' : '완료하고 변경 내용 저장' })
    expect(save).toBeDisabled()
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    await user.type(within(dialog).getByLabelText('팀에 알릴 변경 제목'), '  검색 결과가 더 빨라졌어요  ')
    await user.click(save)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '작업을 완료할까요?' })).not.toBeInTheDocument())
    const request = fetcher.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(request[1]!.body as string)).toMatchObject({ patchNoteTitle: '검색 결과가 더 빨라졌어요', githubState: 'CLOSED', details: { status: 'DONE', title: seed.title } })
  })
  it('완료를 취소하면 상태를 저장하지 않는다', async () => {
    const fetcher = setup({ publishStatus: 'LOCAL' })
    const user = await moveWithMenu('완료로')
    const dialog = screen.getByRole('dialog', { name: '작업을 완료할까요?' })
    await user.type(within(dialog).getByLabelText('팀에 알릴 변경 제목'), '팀에 알릴 제목')
    await user.click(within(dialog).getByRole('button', { name: '취소' }))
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
    expect(column('진행 중').getByRole('button', { name: /검색 응답 개선/ })).toBeInTheDocument()
  })
  it('완료 저장에 실패하면 제목을 유지하고 다시 저장할 수 있다', async () => {
    const fetcher = setup({ status: 'IN_PROGRESS' })
    const original = fetcher.getMockImplementation()!
    let fail = true
    fetcher.mockImplementation(async (path, init) => {
      if (init?.method === 'PATCH' && fail) { fail = false; return Response.json({ message: '잠시 후 다시 시도해 주세요.' }, { status: 503 }) }
      return original(path, init)
    })
    const user = await moveWithMenu('완료로')
    const dialog = screen.getByRole('dialog', { name: '작업을 완료할까요?' })
    await user.type(within(dialog).getByLabelText('팀에 알릴 변경 제목'), '검색 결과 개선')
    await user.click(within(dialog).getByRole('button', { name: '완료하고 GitHub 이슈 닫기' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.')
    expect(within(dialog).getByLabelText('팀에 알릴 변경 제목')).toHaveValue('검색 결과 개선')
    await user.click(within(dialog).getByRole('button', { name: '완료하고 GitHub 이슈 닫기' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '작업을 완료할까요?' })).not.toBeInTheDocument())
  })
  it('기존 GitHub 이슈를 배정한 뒤 선택해서 브랜치를 만든다', async () => {
    const fetcher = setup({ status: 'BACKLOG' })
    const user = await moveWithMenu('진행 중으로')
    const dialog = screen.getByRole('dialog', { name: '이번에 진행할 작업을 정해요' })
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH' || init?.method === 'POST')).toBe(false)
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '배정하고 진행 중으로' })).toBeEnabled())
    await user.click(within(dialog).getByRole('button', { name: '배정하고 진행 중으로' }))
    await user.click(await screen.findByRole('button', { name: '브랜치 만들기' }))
    expect(await screen.findByLabelText('작업 브랜치 전환 명령어')).toHaveTextContent('git switch feat/23')
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/issues/20/branch', expect.objectContaining({ method: 'POST', body: JSON.stringify({ version: 3 }) }))
    expect(fetcher.mock.calls.some(([path]) => path.endsWith('/publish'))).toBe(false)
    await user.click(screen.getByRole('button', { name: '확인' }))
    expect(column('진행 중').getByTitle('작업 브랜치 feat/23')).toBeInTheDocument()
  })
  it('브랜치는 나중에 만들 수 있고 GitHub 이슈를 중복 생성하지 않는다', async () => {
    const fetcher = setup({ status: 'BACKLOG' })
    const user = await moveWithMenu('진행 중으로')
    await waitFor(() => expect(screen.getByRole('button', { name: '배정하고 진행 중으로' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '배정하고 진행 중으로' }))
    await user.click(await screen.findByRole('button', { name: '지금은 건너뛰기' }))
    expect(column('진행 중').getByRole('button', { name: /검색 응답 개선/ })).toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path, init]) => path.endsWith('/branch') && init?.method === 'POST')).toBe(false)
    expect(fetcher.mock.calls.some(([path]) => path.endsWith('/publish'))).toBe(false)
  })
  it('검토 중으로 옮기면 작업 브랜치의 PR을 추천하고 연결 후 검토 중에 둔다', async () => {
    const fetcher = setup({ status: 'IN_PROGRESS', workBranch: 'feat/23' }, [pull('31', 31, 'feat/other'), pull('41', 41, 'feat/23')])
    const user = await moveWithMenu('검토 중으로')
    const dialog = screen.getByRole('dialog', { name: '어떤 PR로 검토를 받을까요?' })
    const choices = await within(dialog).findAllByRole('radio')
    expect(choices[0]).toHaveAccessibleName(/#41 PR 41작업 브랜치/)
    expect(choices[0]).toBeChecked()
    await user.click(within(dialog).getByRole('button', { name: /PR 연결/ }))
    await waitFor(() => expect(column('검토 중').getByRole('button', { name: /검색 응답 개선/ })).toBeInTheDocument())
    expect(fetcher.mock.calls.some(([path, init]) => path === '/api/projects/1/issues/20/pull-requests/41?version=2' && init?.method === 'POST')).toBe(true)
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false)
  })
  it('초안 PR을 연결하면 진행 중에 남는다고 안내한다', async () => {
    setup({ status: 'IN_PROGRESS', workBranch: 'feat/23' }, [pull('41', 41, 'feat/23', true)])
    const user = await moveWithMenu('검토 중으로')
    const dialog = screen.getByRole('dialog', { name: '어떤 PR로 검토를 받을까요?' })
    expect(await within(dialog).findByText(/초안 PR이라 연결해도 진행 중에 남아요/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /PR 연결/ }))
    expect(await screen.findByText(/#41을 연결했어요. 초안 PR이라 진행 중에 남아요/)).toBeInTheDocument()
  })
  it('열린 PR이 정한 단계는 손으로 바꾸지 않고 이유를 알려준다', async () => {
    const open = pull('41', 41, 'feat/23')
    const fetcher = setup({ status: 'IN_REVIEW', workBranch: 'feat/23', pullRequests: [linked(open)] })
    await moveWithMenu('진행 중으로')
    expect(screen.getByRole('dialog', { name: 'PR 상태로 단계가 정해져요' })).toHaveTextContent('#41 · PR 41 · 검토 중')
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'PATCH' || init?.method === 'POST')).toBe(false)
  })
  it('끄는 동안 카드가 갈 열에 놓으면 일어날 일을 보여준다', async () => {
    const user = userEvent.setup()
    const item = { id: 'a', key: 'Z-1', title: '끌 작업', status: 'backlog' as const, priority: 'medium' as const, repositoryId: 'repo', repositoryName: 'server', assignee: null, sourceLabel: '수시 요청', plannedWeekStart: week, dropHints: { in_progress: { label: '놓으면 feat/1 브랜치를 만들 수 있어요', tone: 'action' as const } } }
    render(<TeamBoard items={[item]} week={week} actions={{ onOpen: vi.fn(), onMove: vi.fn(), onAssign: vi.fn(), loadAssignees: async () => ({ items: [], hasNext: false }) }} />)
    expect(screen.queryByText('놓으면 feat/1 브랜치를 만들 수 있어요')).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Z-1 끌어서 옮기기' }).focus()
    await user.keyboard('[Space]')
    expect(await column('진행 중').findByText('놓으면 feat/1 브랜치를 만들 수 있어요')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText('놓으면 feat/1 브랜치를 만들 수 있어요')).not.toBeInTheDocument())
  })
})
