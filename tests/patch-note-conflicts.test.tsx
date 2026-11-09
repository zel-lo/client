import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { Notes } from '../src/components/patch-notes'
import type { Note, WorkChange } from '../src/lib/workspace-api'

const issue: WorkChange = { id: '9', issueId: '11', pullRequestId: null, title: '로그인 개선', summary: '', category: 'IMPROVE', status: 'COMPLETED', occurredAt: '2026-11-09T00:00:00', needsTitle: false }
const teammateChange: WorkChange = { ...issue, id: '10', issueId: null, pullRequestId: '12', title: '동료가 연결한 PR', status: 'MERGED' }
const myChange: WorkChange = { ...issue, id: '11', issueId: '13', title: '내가 연결할 작업' }
function setup(peer: Partial<Note> = { summary: '동료가 작성한 소개' }) {
  let note: Note = { id: '5', title: '원래 제목', summary: '원래 소개', status: 'DRAFT', version: 3, author: 'owner', publishedAt: null, automatic: false, changes: [issue] }
  let firstSave = true
  const saves: Record<string, unknown>[] = []
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (path.endsWith('/changes/9') && init?.method === 'PATCH') {
      const input = JSON.parse(init.body as string)
      if (input.version !== note.version) return Response.json({ code: 'VERSION_CONFLICT', message: '다른 팀원이 수정했어요.' }, { status: 409 })
      note = { ...note, version: note.version + 1, changes: note.changes!.map(change => ({ ...change, title: input.title })) }
      return Response.json(note)
    }
    if (path.endsWith('/patch-notes/5') && init?.method === 'PATCH') {
      const input = JSON.parse(init.body as string)
      saves.push(input)
      if (firstSave) { firstSave = false; note = { ...note, ...peer, version: note.version + 1 }; return Response.json({ code: 'VERSION_CONFLICT', message: '다른 팀원이 수정했어요.' }, { status: 409 }) }
      if (input.version !== note.version) return Response.json({ code: 'VERSION_CONFLICT', message: '다른 팀원이 수정했어요.' }, { status: 409 })
      note = { ...note, title: input.title, summary: input.summary, version: note.version + 1, status: note.status === 'PUBLISHED' || input.publish ? 'PUBLISHED' : 'DRAFT', changes: input.changeIds?.map((id: string) => [...note.changes!, myChange, teammateChange].find(change => change.id === id)!) ?? note.changes }
      return Response.json(note)
    }
    if (path.endsWith('/patch-notes/5')) return Response.json(note)
    if (path.includes('/patch-note-changes?')) return Response.json({ items: [issue, teammateChange, myChange], page: 1, hasNext: false })
    if (path.includes('/patch-notes?page=')) return Response.json({ items: [note], page: 1, hasNext: false })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  render(<MemoryRouter initialEntries={['/changes?note=5']}><Notes project={{ id: '1', name: '팀', description: null, role: 'OWNER', canManageRepositories: true }} /></MemoryRouter>)
  return { saves, current: () => note, remoteEdit: (update: Partial<Note>) => { note = { ...note, ...update, version: note.version + 1 }; firstSave = false; window.dispatchEvent(new Event('zello:workspace-updated')) } }
}

describe('패치노트 동시 편집 보호', () => {
  it('충돌 후 내 제목과 동료의 소개를 합쳐 최신 버전으로 저장한다', async () => {
    const state = setup(), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.clear(screen.getByLabelText('업데이트 제목'))
    await user.type(screen.getByLabelText('업데이트 제목'), '내가 작성한 제목')
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    const conflict = await screen.findByRole('region', { name: '최신 변경 내용 확인' })
    expect(screen.getByLabelText('업데이트 제목')).toHaveValue('내가 작성한 제목')
    expect(screen.getByRole('button', { name: '초안 저장' })).toBeDisabled()
    await user.click(within(conflict).getByRole('button', { name: '최신 변경과 합쳐 편집 계속' }))
    expect(screen.getByLabelText('변경 내용')).toHaveValue('동료가 작성한 소개')
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(screen.queryByRole('form', { name: '패치노트 편집' })).not.toBeInTheDocument())
    expect(state.current()).toMatchObject({ title: '내가 작성한 제목', summary: '동료가 작성한 소개' })
    expect(state.saves.at(-1)).toMatchObject({ version: 4 })
  })

  it('최신 반영 제목 저장이 오래된 본문 편집기의 버전을 몰래 올리지 않는다', async () => {
    const state = setup(), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.type(screen.getByLabelText('업데이트 제목'), ' 내 수정')
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await screen.findByRole('region', { name: '최신 변경 내용 확인' })
    await user.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: '제목 수정' }))
    await user.clear(screen.getByLabelText('팀에 알릴 변경 제목'))
    await user.type(screen.getByLabelText('팀에 알릴 변경 제목'), '새 반영 제목')
    await user.click(screen.getByRole('button', { name: '제목 저장' }))
    await screen.findByRole('heading', { name: '새 반영 제목' })
    expect(screen.getByRole('button', { name: '초안 저장' })).toBeDisabled()
    expect(state.saves).toHaveLength(1)
    expect(state.current().summary).toBe('동료가 작성한 소개')
    await user.click(screen.getByRole('button', { name: '최신 변경과 합쳐 편집 계속' }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(state.saves).toHaveLength(2))
    expect(state.saves.at(-1)).toMatchObject({ version: 5, summary: '동료가 작성한 소개' })
  })

  it('본문 저장 오류 없이 최신 기록을 조회했어도 항목 편집이 오래된 초안을 몰래 갱신하지 않는다', async () => {
    const state = setup(), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.type(screen.getByLabelText('업데이트 제목'), ' 내 수정')
    await act(async () => state.remoteEdit({ summary: '동료가 새로 저장한 소개' }))
    await screen.findByText('동료가 새로 저장한 소개')
    await user.click(screen.getByRole('button', { name: '제목 수정' }))
    await user.type(screen.getByLabelText('팀에 알릴 변경 제목'), ' 추가')
    await user.click(screen.getByRole('button', { name: '제목 저장' }))
    await screen.findByRole('region', { name: '최신 변경 내용 확인' })
    expect(state.saves).toHaveLength(0)
    expect(screen.getByRole('button', { name: '초안 저장' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '최신 변경과 합쳐 편집 계속' }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(state.saves).toHaveLength(1))
    expect(state.saves[0]).toMatchObject({ version: 5, title: '원래 제목 내 수정', summary: '동료가 새로 저장한 소개' })
  })

  it.each(['mine', 'latest'] as const)('같은 본문을 수정했으면 명시적으로 선택한 %s 내용을 사용한다', async choice => {
    const state = setup({ title: '동료의 제목', summary: '동료의 본문' }), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.clear(screen.getByLabelText('변경 내용'))
    await user.type(screen.getByLabelText('변경 내용'), '내 본문')
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    const group = await screen.findByRole('group', { name: '변경 내용 선택' })
    expect(screen.getByRole('button', { name: '선택한 내용으로 편집 계속' })).toBeDisabled()
    await user.click(within(group).getByRole('radio', { name: choice === 'mine' ? '내가 작성한 내용' : '최신 저장 내용' }))
    await user.click(screen.getByRole('button', { name: '선택한 내용으로 편집 계속' }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(state.saves).toHaveLength(2))
    expect(state.saves.at(-1)).toMatchObject({ title: '동료의 제목', summary: choice === 'mine' ? '내 본문' : '동료의 본문', version: 4 })
  })

  it('내 연결 추가·해제와 동료가 추가한 연결을 함께 보존한다', async () => {
    const state = setup({ changes: [issue, teammateChange] }), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.click(screen.getByRole('button', { name: '로그인 개선 연결 해제' }))
    await user.click(await screen.findByRole('checkbox', { name: /내가 연결할 작업/ }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await user.click(await screen.findByRole('button', { name: '최신 변경과 합쳐 편집 계속' }))
    const selected = screen.getByRole('list', { name: '연결할 변경 사항' })
    expect(within(selected).queryByText(issue.title)).not.toBeInTheDocument()
    expect(within(selected).getByText(myChange.title)).toBeInTheDocument()
    expect(within(selected).getByText(teammateChange.title)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(state.saves).toHaveLength(2))
    expect(state.saves.at(-1)).toMatchObject({ changeIds: ['10', '11'], version: 4 })
  })

  it('다른 팀원이 이미 공개한 글은 공개된 연결을 유지하고 본문만 편집한다', async () => {
    const state = setup({ status: 'PUBLISHED', changes: [teammateChange] }), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.click(await screen.findByRole('checkbox', { name: /내가 연결할 작업/ }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await screen.findByText(/다른 팀원이 이미 공개한 글/)
    await user.click(screen.getByRole('button', { name: '최신 변경과 합쳐 편집 계속' }))
    expect(screen.queryByRole('group', { name: /변경 사항 연결/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(state.saves).toHaveLength(2))
    expect(state.saves.at(-1)).not.toHaveProperty('changeIds')
    expect(state.current().changes).toEqual([teammateChange])
  })

  it('연결만 바뀐 충돌에서는 동료가 해제한 연결을 되살리지 않는다', async () => {
    const state = setup({ changes: [] }), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.type(screen.getByLabelText('업데이트 제목'), ' 수정')
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await user.click(await screen.findByRole('button', { name: '최신 변경과 합쳐 편집 계속' }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(state.saves).toHaveLength(2))
    expect(state.saves.at(-1)).toMatchObject({ changeIds: [], version: 4 })
  })

  it('연결을 합쳐 100개를 넘으면 일부를 해제하기 전까지 저장하지 않는다', async () => {
    const additions = Array.from({ length: 99 }, (_, index) => ({ ...issue, id: String(index + 20), title: `동료 작업 ${index}` }))
    const state = setup({ changes: [issue, ...additions] }), user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.click(await screen.findByRole('checkbox', { name: /내가 연결할 작업/ }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await user.click(await screen.findByRole('button', { name: '최신 변경과 합쳐 편집 계속' }))
    expect(screen.getByText('101/100개 선택')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '초안 저장' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '내가 연결할 작업 연결 해제' }))
    expect(screen.getByRole('button', { name: '초안 저장' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await waitFor(() => expect(state.saves).toHaveLength(2))
    expect(state.saves.at(-1)?.changeIds).toHaveLength(100)
  })

  it('초안을 취소하면 충돌 안내도 닫고 최신 내용을 다시 편집할 수 있다', async () => {
    setup(); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '내용 편집' }))
    await user.click(screen.getByRole('button', { name: '초안 저장' }))
    await screen.findByRole('region', { name: '최신 변경 내용 확인' })
    await user.click(screen.getByRole('button', { name: '취소', exact: true }))
    expect(screen.queryByRole('region', { name: '최신 변경 내용 확인' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '내용 편집' }))
    expect(screen.getByLabelText('변경 내용')).toHaveValue('동료가 작성한 소개')
  })
})
