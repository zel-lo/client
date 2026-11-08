import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Notes } from '../src/components/workspace-panels'
import type { Note } from '../src/lib/workspace-api'

function setup(role = 'OWNER', status = 'DRAFT', detail = true) {
  let note: Note = { id: '5', title: '이번 주 변경 사항', summary: '완료한 작업을 확인해 주세요.', status, version: 3, author: 'owner', publishedAt: null, automatic: true,
    changes: [{ id: '9', issueId: null, pullRequestId: '7', title: 'fix: search', summary: 'GitHub에서 가져온 PR 본문', category: 'FIX', status: 'MERGED', occurredAt: '2026-11-08T00:00:00', needsTitle: true }] }
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (path.endsWith('/changes/9') && init?.method === 'PATCH') {
      const input = JSON.parse(init.body as string)
      note = { ...note, version: note.version + 1, changes: note.changes!.map(c => ({ ...c, title: input.title, needsTitle: false })) }
      return Response.json(note)
    }
    if (path.endsWith('/patch-notes/5') && init?.method === 'PATCH') {
      note = { ...note, ...JSON.parse(init.body as string), status: 'PUBLISHED', version: note.version + 1 }
      return Response.json(note)
    }
    if (path.endsWith('/patch-notes/5')) return Response.json(note)
    if (path.includes('patch-notes?page=')) return Response.json({ items: [note], page: 1, hasNext: false })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter initialEntries={[detail ? '/changes?note=5' : '/changes']}><Notes project={{ id: '1', name: '프로젝트', description: null, role, canManageRepositories: true }} /></MemoryRouter>)
  return fetcher
}

describe('패치노트 반영 제목', () => {
  it('GitHub 완료 기록을 작성 필요로 표시하고 제목을 작성한 뒤 공개한다', async () => {
    const fetcher = setup(), user = userEvent.setup()
    expect(await screen.findByText('반영 사항 작성 필요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '내용 편집' }))
    expect(screen.getByRole('button', { name: '팀에 공개' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '반영 사항 작성' }))
    expect(screen.getByLabelText('패치노트 제목')).toHaveValue('')
    expect(screen.getByRole('button', { name: '반영 사항 저장' })).toBeDisabled()
    await user.type(screen.getByLabelText('패치노트 제목'), '검색 오류를 수정했어요')
    await user.click(screen.getByRole('button', { name: '반영 사항 저장' }))
    await waitFor(() => expect(screen.queryByText('반영 사항 작성 필요')).not.toBeInTheDocument())
    expect(screen.getByRole('heading', { name: '검색 오류를 수정했어요' })).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/patch-notes/5/changes/9', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: '검색 오류를 수정했어요', version: 3 }), headers: expect.objectContaining({ 'X-CSRF-TOKEN': 'csrf' }) }))
    await user.click(screen.getByRole('button', { name: '팀에 공개' }))
    await screen.findByText('공개됨')
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/patch-notes/5', expect.objectContaining({ body: JSON.stringify({ title: '이번 주 변경 사항', summary: '완료한 작업을 확인해 주세요.', publish: true, version: 4 }) }))
  })
  it('조회자는 반영 사항을 읽을 수 있고 수정할 수 없다', async () => {
    setup('VIEWER')
    await screen.findByText('반영 사항 작성 필요')
    expect(screen.queryByRole('button', { name: '반영 사항 작성' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '내용 편집' })).not.toBeInTheDocument()
  })
  it('공개한 기록에는 작성 요청이나 반영 제목 편집을 표시하지 않는다', async () => {
    setup('OWNER', 'PUBLISHED')
    await screen.findByText('공개됨')
    expect(screen.queryByText('반영 사항 작성 필요')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '반영 사항 작성' })).not.toBeInTheDocument()
  })
})

it('변경 소식 첫 화면에서 같은 패치노트의 변경을 각각 날짜와 함께 섹션별로 보여준다', async () => {
  const user = userEvent.setup()
  const note: Note = { id: '2', title: '주간 묶음 제목', summary: '주간 상세 본문', status: 'PUBLISHED', version: 0, author: 'owner', publishedAt: '2026-11-09T00:00:00', createdAt: '2026-11-02T00:00:00', automatic: true,
    changes: [
      { id: '1', issueId: '11', pullRequestId: null, title: '컬렉션을 공유할 수 있어요', summary: '첫 내용', category: 'FEATURE', status: 'COMPLETED', occurredAt: '2026-11-08T00:00:00', needsTitle: false },
      { id: '2', issueId: null, pullRequestId: '12', title: '공유 링크를 복사할 수 있어요', summary: '둘째 내용', category: 'FEATURE', status: 'MERGED', occurredAt: '2026-11-08T01:00:00', needsTitle: false },
      { id: '3', issueId: null, pullRequestId: '13', title: '검색 오류를 수정했어요', summary: '셋째 내용', category: 'FIX', status: 'MERGED', occurredAt: '2026-11-08T02:00:00', needsTitle: false },
    ] }
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path.includes('patch-notes?page=')) return Response.json({ items: [note], page: 1, hasNext: false })
    if (path.endsWith('/patch-notes/2')) return Response.json(note)
    return new Response(null, { status: 404 })
  }))
  render(<MemoryRouter><Notes project={{ id: '1', name: '프로젝트', description: null, role: 'VIEWER', canManageRepositories: false }} /></MemoryRouter>)
  const feature = await screen.findByRole('region', { name: '새 기능' })
  expect(within(feature).getAllByRole('listitem')).toHaveLength(2)
  expect(within(feature).getAllByText('11월 8일')).toHaveLength(2)
  expect(within(feature).getByRole('heading', { name: '컬렉션을 공유할 수 있어요' })).toBeInTheDocument()
  const fixes = screen.getByRole('region', { name: '오류 수정' })
  expect(within(fixes).getByRole('heading', { name: '검색 오류를 수정했어요' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: '주간 묶음 제목' })).not.toBeInTheDocument()
  expect(screen.queryByText('11월 9일')).not.toBeInTheDocument()
  expect(screen.queryByText('첫 내용')).not.toBeInTheDocument()
  await user.click(within(fixes).getByRole('link', { name: '패치노트 보기' }))
  expect(await screen.findByRole('heading', { name: '주간 묶음 제목' })).toBeInTheDocument()
  expect(screen.getByText('주간 상세 본문')).toBeInTheDocument()
})

it('직접 쓴 글도 팀 소식 섹션에 날짜와 제목을 표시한다', async () => {
  vi.stubGlobal('fetch', vi.fn(async (path: string) => path.includes('patch-notes?page=') ? Response.json({ items: [{ id: '8', title: '팀에서 전하는 소식', summary: '본문', status: 'DRAFT', version: 0, author: 'owner', publishedAt: null, createdAt: '2026-11-08T23:30:00', changes: [] }], page: 1, hasNext: false }) : new Response(null, { status: 404 })))
  render(<MemoryRouter><Notes project={{ id: '1', name: '프로젝트', description: null, role: 'VIEWER', canManageRepositories: false }} /></MemoryRouter>)
  const team = await screen.findByRole('region', { name: '팀 소식' })
  expect(within(team).getByText('11월 9일')).toBeInTheDocument()
  expect(within(team).getByRole('heading', { name: '팀에서 전하는 소식' })).toBeInTheDocument()
})

it('첫 화면의 개별 변경에서 반영 제목을 바로 작성할 수 있다', async () => {
  const fetcher = setup('OWNER', 'DRAFT', false), user = userEvent.setup()
  const fixes = await screen.findByRole('region', { name: '오류 수정' })
  expect(within(fixes).getByText('반영 사항 작성 필요')).toBeInTheDocument()
  await user.click(within(fixes).getByRole('button', { name: '반영 사항 작성' }))
  await user.type(within(fixes).getByLabelText('패치노트 제목'), '검색 결과를 안정적으로 확인할 수 있어요')
  await user.click(within(fixes).getByRole('button', { name: '반영 사항 저장' }))
  expect(await within(fixes).findByRole('heading', { name: '검색 결과를 안정적으로 확인할 수 있어요' })).toBeInTheDocument()
  expect(within(fixes).queryByText('반영 사항 작성 필요')).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledWith('/api/projects/1/patch-notes/5/changes/9', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ title: '검색 결과를 안정적으로 확인할 수 있어요', version: 3 }) }))
})
