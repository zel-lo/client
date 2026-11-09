import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Notes } from '../src/components/patch-notes'
import type { Note, WorkChange } from '../src/lib/workspace-api'

const issue: WorkChange = { id: '9', issueId: '11', pullRequestId: null, title: '로그인 흐름 개선', summary: '작업 설명', category: 'IMPROVE', status: 'COMPLETED', occurredAt: '2026-11-09T01:00:00', needsTitle: false }
const pull: WorkChange = { ...issue, id: '10', issueId: null, pullRequestId: '12', title: '검색 오류 수정', category: 'FIX', status: 'MERGED' }
const project = { id: '1', name: '프로젝트', description: null, role: 'OWNER', canManageRepositories: true }
function setup({ detail = false, status = 'DRAFT', fail = false, needsTitle = false, linkedTitle = issue.title } = {}) {
  let note: Note = { id: '5', title: '팀 소식', summary: '업데이트 소개', status, version: 3, author: 'owner', publishedAt: null, automatic: false, changes: [{ ...issue, title: linkedTitle }] }
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (path.includes('/patch-note-changes?')) {
      const query = new URL(path, 'http://localhost').searchParams
      const items = query.get('page') === '2' ? [pull] : [needsTitle ? { ...issue, needsTitle: true } : issue]
      return Response.json({ items: query.get('search') ? [pull] : items, page: Number(query.get('page')), hasNext: !query.get('search') && query.get('page') === '1' })
    }
    if (path.endsWith('/changes/9') && init?.method === 'PATCH') {
      note = { ...note, version: note.version + 1, changes: note.changes!.map(change => ({ ...change, title: JSON.parse(init.body as string).title, needsTitle: false })) }
      return Response.json(note)
    }
    if ((path.endsWith('/patch-notes') && init?.method === 'POST') || (path.endsWith('/patch-notes/5') && init?.method === 'PATCH')) {
      if (fail) return Response.json({ message: '다른 팀원이 수정했어요.' }, { status: 409 })
      const input = JSON.parse(init.body as string)
      note = { ...note, ...input, version: note.version + 1, status: input.publish ? 'PUBLISHED' : 'DRAFT', changes: input.changeIds?.map((id: string) => id === '9' ? { ...issue, needsTitle } : pull) ?? note.changes }
      return Response.json(note)
    }
    if (path.endsWith('/patch-notes/5')) return Response.json(note)
    if (path.includes('/patch-notes?page=')) return Response.json({ items: detail ? [note] : [], page: 1, hasNext: false })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter initialEntries={[detail ? '/changes?note=5' : '/changes']}><Notes project={project} /></MemoryRouter>)
  return fetcher
}

describe('팀 업데이트 변경 연결', () => {
  it('서로 다른 페이지의 작업과 PR을 선택해 저장하고 원본 링크를 표시한다', async () => {
    const fetcher = setup(), user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '팀 업데이트 작성' }))
    await user.type(screen.getByLabelText('업데이트 제목'), '이번 출시 소식')
    await user.type(screen.getByLabelText('변경 내용'), '작업과 PR을 함께 소개합니다.')
    await user.click(await screen.findByRole('checkbox', { name: /로그인 흐름 개선/ }))
    await user.click(within(screen.getByRole('navigation', { name: '연결할 변경 사항 페이지' })).getByRole('button', { name: '다음' }))
    await user.click(await screen.findByRole('checkbox', { name: /검색 오류 수정/ }))
    expect(screen.getByText('2/100개 선택')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    expect(await screen.findByRole('heading', { name: '이번 출시 소식' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '관련 작업' })).toHaveAttribute('href', '/issues?issue=11')
    expect(screen.getByRole('link', { name: '관련 PR' })).toHaveAttribute('href', '/pull-requests?pr=12')
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/patch-notes', expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: '이번 출시 소식', summary: '작업과 PR을 함께 소개합니다.', publish: false, changeIds: ['9', '10'] }) }))
    await user.click(screen.getByRole('button', { name: '내용 편집' }))
    const selected = screen.getByRole('list', { name: '연결할 변경 사항' })
    expect(within(selected).getByText(issue.title)).toBeInTheDocument()
    expect(within(selected).getByText(pull.title)).toBeInTheDocument()
  })
  it('검색 후 연결을 바꾸고 저장 실패 시 작성 내용과 선택을 유지한다', async () => {
    const fetcher = setup({ detail: true, fail: true }), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.click(screen.getByRole('button', { name: '로그인 흐름 개선 연결 해제' }))
    await user.type(screen.getByLabelText('변경 사항 검색'), '검색')
    await user.click(await screen.findByRole('checkbox', { name: /검색 오류 수정/ }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('다른 팀원이 수정했어요.')
    expect(screen.getByLabelText('업데이트 제목')).toHaveValue('팀 소식')
    expect(screen.getByRole('checkbox', { name: /검색 오류 수정/ })).toBeChecked()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/1/patch-notes/5', expect.objectContaining({ body: JSON.stringify({ title: '팀 소식', summary: '업데이트 소개', publish: false, version: 3, changeIds: ['10'] }) }))
  })
  it('미작성 반영 제목은 초안을 저장한 뒤 작성하고 공개한다', async () => {
    setup({ needsTitle: true }); const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '팀 업데이트 작성' }))
    await user.type(screen.getByLabelText('업데이트 제목'), '출시')
    await user.type(screen.getByLabelText('변경 내용'), '변경 소개')
    await user.click(await screen.findByRole('checkbox', { name: /로그인 흐름 개선/ }))
    expect(screen.getByRole('button', { name: '팀에 공개' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await user.click(await screen.findByRole('button', { name: '제목 작성' }))
    await user.type(screen.getByLabelText('팀에 알릴 변경 제목'), '로그인을 더 편하게')
    await user.click(screen.getByRole('button', { name: '제목 저장' }))
    await waitFor(() => expect(screen.queryByText('제목 작성 필요')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '내용 편집' }))
    expect(screen.getByRole('button', { name: '팀에 공개' })).toBeEnabled()
  })
  it('공개한 글의 내용 편집에는 연결 변경 화면을 표시하지 않는다', async () => {
    setup({ detail: true, status: 'PUBLISHED' }); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    expect(screen.queryByRole('group', { name: /변경 사항 연결/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '관련 작업' })).toBeInTheDocument()
  })
  it('기존 연결을 해제했다 다시 선택해도 이 글에서 작성한 제목을 유지한다', async () => {
    setup({ detail: true, linkedTitle: '직접 다듬은 반영 제목', needsTitle: true }); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.click(screen.getByRole('button', { name: '직접 다듬은 반영 제목 연결 해제' }))
    await user.click(await screen.findByRole('checkbox', { name: /로그인 흐름 개선/ }))
    expect(within(screen.getByRole('list', { name: '연결할 변경 사항' })).getByText('직접 다듬은 반영 제목')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '팀에 공개' })).toBeEnabled()
  })
})
