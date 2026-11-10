import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LiveIssues } from '../src/components/live-issues'
import type { Project } from '../src/lib/project-api'

const project: Project = { id: '1', name: '팀 프로젝트', role: 'MEMBER', description: null, canManageRepositories: false }

describe('팀 작업 담당자 필터', () => {
  it('작업이 없는 팀원과 다음 페이지 팀원도 선택하고 빈 결과에서도 선택지를 유지한다', async () => {
    const fetcher = vi.fn(async (path: string) => {
      if (path.includes('/members?')) {
        const page = Number(new URL(path, 'http://test').searchParams.get('page'))
        return Response.json({ items: [{ login: page === 1 ? 'owner' : 'teammate' }], hasNext: page === 1 })
      }
      if (path.endsWith('/repositories')) return Response.json([])
      if (path.includes('/issues?')) return Response.json({ items: [], total: 0, page: 1, hasNext: false })
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal('fetch', fetcher)
    render(<MemoryRouter><LiveIssues project={project} /></MemoryRouter>)
    const filter = screen.getByRole('combobox', { name: '담당자 필터' })
    await within(filter).findByRole('option', { name: 'teammate' })
    expect(within(filter).getByRole('option', { name: 'owner' })).toBeInTheDocument()
    await userEvent.setup().selectOptions(filter, 'teammate')
    await waitFor(() => expect(fetcher.mock.calls.some(([path]) => path.includes('/issues?') && new URL(path, 'http://test').searchParams.get('assignee') === 'teammate')).toBe(true))
    expect(filter).toHaveValue('teammate')
    expect(within(filter).getByRole('option', { name: 'owner' })).toBeInTheDocument()
    expect(fetcher.mock.calls.filter(([path]) => path.includes('/members?'))).toHaveLength(2)
  })

  it('담당자 조회 실패가 작업 목록을 막지 않으며 다시 불러올 수 있다', async () => {
    let failed = true
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      if (path.includes('/members?')) return failed
        ? Response.json({ message: '일시적인 조회 오류' }, { status: 503 })
        : Response.json({ items: [{ login: 'teammate' }], hasNext: false })
      if (path.endsWith('/repositories')) return Response.json([])
      return Response.json({ items: [], total: 0, page: 1, hasNext: false })
    }))
    render(<MemoryRouter><LiveIssues project={project} /></MemoryRouter>)
    await screen.findByText('표시할 작업이 없어요')
    failed = false
    await userEvent.setup().click(await screen.findByRole('button', { name: '담당자 다시 불러오기' }))
    await within(screen.getByRole('combobox', { name: '담당자 필터' })).findByRole('option', { name: 'teammate' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('프로젝트가 바뀌면 이전 팀원의 이름을 표시하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async (path: string) => {
      if (path.includes('/members?')) return Response.json({ items: [{ login: path.includes('/projects/1/') ? 'first-team' : 'second-team' }], hasNext: false })
      if (path.endsWith('/repositories')) return Response.json([])
      return Response.json({ items: [], total: 0, page: 1, hasNext: false })
    }))
    const tree = (value: Project) => <MemoryRouter><LiveIssues project={value} /></MemoryRouter>
    const view = render(tree(project))
    await screen.findByRole('option', { name: 'first-team' })
    view.rerender(tree({ ...project, id: '2' }))
    expect(screen.queryByRole('option', { name: 'first-team' })).not.toBeInTheDocument()
    await screen.findByRole('option', { name: 'second-team' })
  })
})
