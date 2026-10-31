import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'
import { reviewSummary } from '../src/components/pull-requests-panel'
import type { Project, PullRequestItem, PullRequestPage } from '../src/lib/project-api'

vi.mock('../src/components/ui/contribution-skyline', async importOriginal => {
  const original = await importOriginal<typeof import('../src/components/ui/contribution-skyline')>()
  return { ...original, default: () => <div aria-label="활동 시각화" /> }
})

const user = { id: '1', githubId: '10', login: 'sinheyy', displayName: 'sinheyy', avatarUrl: null, email: null, theme: 'light' }
const project: Project = { id: '7', name: '실제 프로젝트', description: null, role: 'OWNER', canManageRepositories: true }
const pull = (id: string, number: number, overrides: Partial<PullRequestItem> = {}): PullRequestItem => ({
  id, repositoryId: '40', repositoryOwner: 'sinheyy', repositoryName: 'zello-test', number, url: `https://github.com/sinheyy/zello-test/pull/${number}`,
  title: `실제 PR ${number}`, headBranch: `feat/${number}`, baseBranch: 'main', state: 'OPEN', draft: false, reviewDecision: 'PENDING', teamSummary: null,
  author: { login: 'sinheyy', avatarUrl: null }, reviewers: [], version: 3, openedAt: null, mergedAt: null, githubUpdatedAt: null, ...overrides,
})
const page = (items: PullRequestItem[]): PullRequestPage => ({
  items, page: 1, hasNext: false,
  counts: { open: items.filter(item => item.state === 'OPEN').length, merged: items.filter(item => item.state === 'MERGED').length, closed: 0 },
})

const connectedRepo = { id: '40', projectId: '7', githubRepositoryId: '30', installationId: null, owner: 'sinheyy', name: 'zello-test', htmlUrl: 'https://github.com/sinheyy/zello-test', description: null, language: null, defaultBranch: 'main', privateRepository: false, status: 'CONNECTED', initialSyncCompleted: false }
type CreateFailure = { status: number; code: string; message: string }

function backend({ projects = [project], everything = [pull('1', 1), pull('2', 2, { author: { login: 'other', avatarUrl: null }, draft: true }), pull('3', 3, { state: 'MERGED', mergedAt: '2026-10-30T00:00:00Z' })], mine = [pull('1', 1)], requested = [pull('4', 4, { author: { login: 'teammate', avatarUrl: null } })], failure = '', createFailures = [] as CreateFailure[], detailBody = 'GitHub에 적은 본문\n두 번째 줄', createWarning = '' } = {}) {
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/me') return Response.json(user)
    if (path === '/api/projects') return Response.json(projects)
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf-value' })
    if (path.endsWith('/pull-requests/sync') && init?.method === 'POST') {
      if (failure) return Response.json({ code: 'GITHUB_ACCESS_RESTRICTED', message: failure }, { status: 403 })
      return Response.json({ collected: 3, skippedRepositories: 0, syncedAt: '2026-10-31T08:00:00Z' })
    }
    if (path === '/api/projects/7/repositories') return Response.json([connectedRepo])
    if (path.endsWith('/repositories/40/reviewer-candidates')) return Response.json({ users: [{ login: 'teammate', avatarUrl: null }, { login: 'designer', avatarUrl: null }], hasMore: false })
    if (path.endsWith('/repositories/40/branches')) return Response.json({ defaultBranch: 'main', branches: ['main', 'feat/a', 'feat/b'], hasMore: false })
    if (path === '/api/projects/7/pull-requests' && init?.method === 'POST') {
      const rejected = createFailures.shift()
      if (rejected) return Response.json({ code: rejected.code, message: rejected.message }, { status: rejected.status })
      return Response.json({ ...pull('9', 9), ...(createWarning ? { warning: createWarning } : {}) }, { status: 201 })
    }
    if (/\/pull-requests\/\d+$/.test(path) && init?.method === 'PATCH') {
      const sent = JSON.parse(init.body as string) as { teamSummary: string; version: number }
      return Response.json({ ...pull(path.split('/').pop()!, 1), teamSummary: sent.teamSummary || null, version: sent.version + 1, body: detailBody })
    }
    if (/\/pull-requests\/\d+$/.test(path)) return Response.json({ ...pull(path.split('/').pop()!, 1), reviewers: [{ login: 'teammate', avatarUrl: null }], body: detailBody })
    if (path.includes('/pull-requests?') && path.includes('reviewer=me')) return Response.json(page(requested))
    if (path.includes('/pull-requests?') && path.includes('author=me')) return Response.json(page(mine))
    if (path.includes('/pull-requests?')) return Response.json(page(everything))
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const mount = (route: string) => render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)

describe('실제 PR 연결', () => {
  it('프로젝트가 있으면 코드 검토에 샘플 대신 서버의 PR을 보여주고 상태를 구분한다', async () => {
    backend()
    mount('/pull-requests')
    expect(await screen.findByRole('button', { name: /실제 PR 1/ })).toBeInTheDocument()
    expect(screen.getByText('GitHub 연동')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /검색 결과를 더 빠르게/ })).not.toBeInTheDocument()
    expect(screen.getByText('초안')).toBeInTheDocument()
    expect(screen.getAllByText('수집 전').length).toBeGreaterThan(0)
    await userEvent.setup().click(screen.getByRole('button', { name: /병합됨/ }))
    expect(screen.getByRole('button', { name: /실제 PR 3/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /실제 PR 1/ })).not.toBeInTheDocument()
  })

  it('상세는 팀 요약과 GitHub 본문을 따로 보여주고, 요약이 비어도 본문으로 채우지 않는다', async () => {
    const fetcher = backend()
    mount('/pull-requests')
    await userEvent.setup().click(await screen.findByRole('button', { name: /실제 PR 1/ }))
    const drawer = screen.getByRole('dialog', { name: 'Pull request 상세' })
    const body = await within(drawer).findByRole('region', { name: 'GitHub PR 본문' })
    expect(within(body).getByText(/GitHub에 적은 본문/)).toBeInTheDocument()
    const summary = within(drawer).getByRole('region', { name: '팀을 위한 변경 요약' })
    expect(within(summary).getByText('아직 작성되지 않았어요.')).toBeInTheDocument()
    expect(within(summary).queryByText(/GitHub에 적은 본문/)).not.toBeInTheDocument()
    expect(within(drawer).getByText('teammate')).toBeInTheDocument()
    expect(within(drawer).getByRole('link', { name: 'GitHub에서 수정' })).toHaveAttribute('href', 'https://github.com/sinheyy/zello-test/pull/1')
    expect(fetcher).toHaveBeenCalledWith('/api/projects/7/pull-requests/1', expect.anything())
  })

  it('GitHub 본문이 비어 있으면 본문 영역을 숨긴다', async () => {
    backend({ detailBody: '' })
    mount('/pull-requests')
    await userEvent.setup().click(await screen.findByRole('button', { name: /실제 PR 1/ }))
    const drawer = screen.getByRole('dialog', { name: 'Pull request 상세' })
    expect(await within(drawer).findByRole('button', { name: '작성하기' })).toBeInTheDocument()
    expect(within(drawer).queryByRole('region', { name: 'GitHub PR 본문' })).not.toBeInTheDocument()
  })

  it('팀 요약은 상세에서 현재 version과 함께 수정한다', async () => {
    const fetcher = backend()
    mount('/pull-requests')
    const control = userEvent.setup()
    await control.click(await screen.findByRole('button', { name: /실제 PR 1/ }))
    const drawer = screen.getByRole('dialog', { name: 'Pull request 상세' })
    await control.click(await within(drawer).findByRole('button', { name: '작성하기' }))
    await control.type(within(drawer).getByRole('textbox', { name: '팀을 위한 변경 요약' }), '검색이 빨라졌어요')
    await control.click(within(drawer).getByRole('button', { name: '저장' }))
    const summary = within(drawer).getByRole('region', { name: '팀을 위한 변경 요약' })
    expect(await within(summary).findByText('검색이 빨라졌어요')).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/7/pull-requests/1', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ teamSummary: '검색이 빨라졌어요', version: 3 }),
    }))
    expect(within(drawer).getByRole('button', { name: '수정' })).toBeInTheDocument()
  })

  it('병합되거나 닫힌 PR은 상세에서 마지막 리뷰 결과로 설명한다', () => {
    expect(reviewSummary({ status: 'merged', review: 'approved' })).toBe('승인 후 병합됨')
    expect(reviewSummary({ status: 'merged', review: 'pending' })).toBe('승인 없이 병합됨')
    expect(reviewSummary({ status: 'merged', review: 'unknown' })).toBe('병합됨 · 리뷰 기록 없음')
    expect(reviewSummary({ status: 'closed', review: 'changes_requested' })).toBe('병합하지 않고 닫힘 · 마지막 리뷰 수정 요청')
    expect(reviewSummary({ status: 'closed', review: 'unknown' })).toBe('병합하지 않고 닫힘')
    expect(reviewSummary({ status: 'open', review: 'pending' })).toBe('검토 대기')
    expect(reviewSummary({ status: 'draft', review: 'unknown' })).toBe('초안 · 아직 검토 요청 전')
  })

  it('승인받고 병합된 PR 상세는 검토 대기가 아니라 승인 후 병합으로 보인다', async () => {
    backend({ everything: [pull('3', 3, { state: 'MERGED', mergedAt: '2026-10-30T00:00:00Z', reviewDecision: 'APPROVED' })] })
    mount('/pull-requests?status=merged')
    await userEvent.setup().click(await screen.findByRole('button', { name: /실제 PR 3/ }))
    const drawer = screen.getByRole('dialog', { name: 'Pull request 상세' })
    expect(within(drawer).getByText('승인 후 병합됨')).toBeInTheDocument()
    expect(within(drawer).queryByText('검토 대기')).not.toBeInTheDocument()
  })

  it('코드 검토 표에 맡긴 리뷰어를 보여준다', async () => {
    backend({ everything: [pull('1', 1, { reviewers: [{ login: 'teammate', avatarUrl: null }, { login: 'designer', avatarUrl: null }] }), pull('2', 2)] })
    mount('/pull-requests')
    const row = (await screen.findByRole('button', { name: /실제 PR 1/ })).closest('tr')!
    expect(within(row).getByText('teammate, designer')).toBeInTheDocument()
    const other = screen.getByRole('button', { name: /실제 PR 2/ }).closest('tr')!
    expect(within(other).getByText('지정 안 함')).toBeInTheDocument()
  })

  it('내 작업의 내 PR 탭은 작성자가 나인 PR만 서버에서 받아 보여준다', async () => {
    const fetcher = backend()
    mount('/my-work')
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('author=me'), expect.anything()))
    const control = userEvent.setup()
    await control.click(await screen.findByRole('button', { name: /^내 PR/ }))
    const region = screen.getByRole('region', { name: '내 작업 목록' })
    expect(await within(region).findByRole('button', { name: /실제 PR 1/ })).toBeInTheDocument()
    expect(within(region).queryByRole('button', { name: /실제 PR 2/ })).not.toBeInTheDocument()
  })

  it('내 작업의 검토 요청 탭은 내가 리뷰어로 지정된 PR만 서버에서 받아 보여준다', async () => {
    const fetcher = backend()
    mount('/my-work')
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('reviewer=me'), expect.anything()))
    const control = userEvent.setup()
    await control.click(await screen.findByRole('button', { name: /^검토 요청/ }))
    const region = screen.getByRole('region', { name: '내 작업 목록' })
    expect(await within(region).findByRole('button', { name: /실제 PR 4/ })).toBeInTheDocument()
    expect(within(region).getByText('teammate')).toBeInTheDocument()
    expect(within(region).queryByRole('button', { name: /실제 PR 1/ })).not.toBeInTheDocument()
    expect(within(region).queryByRole('button', { name: /샘플/ })).not.toBeInTheDocument()
  })

  it('검토 요청이 없으면 빈 상태를 보여준다', async () => {
    backend({ requested: [] })
    mount('/my-work')
    await userEvent.setup().click(await screen.findByRole('button', { name: /^검토 요청/ }))
    expect(await screen.findByText('요청받은 코드 검토가 없어요')).toBeInTheDocument()
  })

  it('새로고침은 CSRF와 함께 수집을 요청한 뒤 목록을 다시 불러온다', async () => {
    const fetcher = backend()
    mount('/pull-requests')
    await screen.findByRole('button', { name: /실제 PR 1/ })
    await userEvent.setup().click(screen.getByRole('button', { name: '데이터 새로고침' }))
    expect(await screen.findByText(/GitHub에서 PR 3개를 가져왔어요/)).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/7/pull-requests/sync', expect.objectContaining({
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf-value' },
    }))
    const lists = fetcher.mock.calls.filter(([path]) => path.includes('/pull-requests?') && !path.includes('author=me') && !path.includes('reviewer=me'))
    expect(lists.length).toBeGreaterThanOrEqual(2)
  })

  it('수집이 실패하면 사유를 알려주고 기존 목록은 유지한다', async () => {
    backend({ failure: '조직의 OAuth 승인이 필요해요.' })
    mount('/pull-requests')
    await screen.findByRole('button', { name: /실제 PR 1/ })
    await userEvent.setup().click(screen.getByRole('button', { name: '데이터 새로고침' }))
    expect(await screen.findByText('조직의 OAuth 승인이 필요해요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /실제 PR 1/ })).toBeInTheDocument()
  })

  async function fillAndSubmit(control: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await within(dialog).findByRole('option', { name: 'main (기본)' })
    await control.clear(within(dialog).getByLabelText('PR 제목'))
    await control.type(within(dialog).getByLabelText('PR 제목'), '새 기능')
    await control.selectOptions(within(dialog).getByLabelText('작업 브랜치'), 'feat/a')
    await control.clear(within(dialog).getByLabelText('팀을 위한 변경 요약'))
    await control.type(within(dialog).getByLabelText('팀을 위한 변경 요약'), '요약 내용')
    await control.click(within(dialog).getByRole('button', { name: '코드 검토 요청' }))
  }
  const postedBodies = (fetcher: ReturnType<typeof backend>) => fetcher.mock.calls
    .filter(([path, init]) => path === '/api/projects/7/pull-requests' && init?.method === 'POST')
    .map(([, init]) => JSON.parse(init!.body as string) as { requestKey: string; repositoryId: string; headBranch: string; baseBranch: string; teamSummary: string; draft: boolean })

  it('PR 작성은 연결된 저장소와 GitHub 브랜치를 골라 실제로 만든다', async () => {
    const fetcher = backend()
    mount('/pull-requests')
    await screen.findByRole('button', { name: /실제 PR 1/ })
    const control = userEvent.setup()
    await control.click(screen.getByRole('button', { name: 'PR 작성' }))
    const dialog = await screen.findByRole('dialog', { name: '새 Pull request' })
    expect(within(dialog).getByRole('option', { name: 'sinheyy/zello-test' })).toBeInTheDocument()
    expect(await within(dialog).findByRole('option', { name: 'main (기본)' })).toBeInTheDocument()
    expect(within(dialog).getByLabelText('작업 브랜치')).not.toContainHTML('value="main"')
    expect(within(dialog).queryByText(/해결할 이슈 선택/)).not.toBeInTheDocument()
    await fillAndSubmit(control, dialog)
    expect(await screen.findByText(/GitHub에 PR zello-test#9을 만들었어요/)).toBeInTheDocument()
    expect(postedBodies(fetcher)[0]).toMatchObject({ repositoryId: '40', headBranch: 'feat/a', baseBranch: 'main', teamSummary: '요약 내용', body: '', reviewers: [], draft: false })
    expect(screen.queryByRole('dialog', { name: '새 Pull request' })).not.toBeInTheDocument()
  })

  it('PR 작성 시 GitHub 본문과 리뷰어를 따로 보내고, 리뷰어 지정 실패는 경고로 알린다', async () => {
    const fetcher = backend({ createWarning: 'PR은 만들었지만 리뷰어를 지정하지 못했어요.' })
    mount('/pull-requests')
    await screen.findByRole('button', { name: /실제 PR 1/ })
    const control = userEvent.setup()
    await control.click(screen.getByRole('button', { name: 'PR 작성' }))
    const dialog = await screen.findByRole('dialog', { name: '새 Pull request' })
    await control.click(await within(dialog).findByRole('checkbox', { name: 'teammate' }))
    await control.type(within(dialog).getByRole('textbox', { name: /GitHub PR 본문/ }), '테스트 방법: 검색해 보기')
    await fillAndSubmit(control, dialog)
    expect(await screen.findByText(/리뷰어를 지정하지 못했어요/)).toBeInTheDocument()
    expect(postedBodies(fetcher)[0]).toMatchObject({ teamSummary: '요약 내용', body: '테스트 방법: 검색해 보기', reviewers: ['teammate'] })
  })

  it('결과를 모르는 실패는 같은 요청 키로, 거절된 실패는 새 요청 키로 다시 보낸다', async () => {
    const fetcher = backend({ createFailures: [
      { status: 503, code: 'GITHUB_RESULT_UNKNOWN', message: 'PR이 만들어졌는지 확인하지 못했어요.' },
      { status: 422, code: 'PULL_REQUEST_NO_CHANGES', message: '변경된 커밋이 없어요.' },
    ] })
    mount('/pull-requests')
    await screen.findByRole('button', { name: /실제 PR 1/ })
    const control = userEvent.setup()
    await control.click(screen.getByRole('button', { name: 'PR 작성' }))
    const dialog = await screen.findByRole('dialog', { name: '새 Pull request' })
    await fillAndSubmit(control, dialog)
    expect(await within(dialog).findByText('PR이 만들어졌는지 확인하지 못했어요.')).toBeInTheDocument()
    await control.click(within(dialog).getByRole('button', { name: '코드 검토 요청' }))
    expect(await within(dialog).findByText('변경된 커밋이 없어요.')).toBeInTheDocument()
    await control.click(within(dialog).getByRole('button', { name: '코드 검토 요청' }))
    await screen.findByText(/GitHub에 PR zello-test#9을 만들었어요/)
    const keys = postedBodies(fetcher).map(body => body.requestKey)
    expect(keys).toHaveLength(3)
    expect(keys[1]).toBe(keys[0])
    expect(keys[2]).not.toBe(keys[1])
  })

  it('프로젝트가 없으면 기존 샘플 PR을 그대로 보여준다', async () => {
    backend({ projects: [] })
    mount('/pull-requests')
    expect(await screen.findByText('샘플 PR · GitHub 미연결')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /검색 결과를 더 빠르게/ })).toBeInTheDocument()
  })

  it('수집한 PR이 아직 없으면 새로고침 안내를 보여준다', async () => {
    backend({ everything: [], mine: [] })
    mount('/pull-requests')
    expect(await screen.findByText('아직 가져온 PR이 없어요')).toBeInTheDocument()
  })
})
