import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MembersPanel } from '../src/components/members-panel'
import { ProjectGeneralSettings } from '../src/components/project-general-settings'
import type { Member, MembersPage } from '../src/lib/members-api'

const member: Member = { userId: '2', githubId: '20', login: 'teammate', displayName: '팀원', avatarUrl: null, role: 'MEMBER', version: 4, joinedAt: '2026-11-01T00:00:00', self: false, canChangeRole: true, canRemove: true, canTransferTo: true }
const owner: Member = { ...member, userId: '1', login: 'owner', displayName: '소유자', role: 'OWNER', self: true, canChangeRole: false, canRemove: false, canTransferTo: false }
const page: MembersPage = { items: [owner, member], total: 2, page: 1, hasNext: false, projectName: '우리 프로젝트', projectVersion: 8, ownerUserId: '1', currentMemberVersion: 3, canInvite: true, canInviteAdmin: true }
const invitation = { id: '7', role: 'MEMBER', expiresAt: '2026-11-04T00:00:00', createdAt: '2026-11-01T00:00:00', status: 'PENDING', createdBy: 'owner', targetLogin: null, acceptedByUserId: null }
const inviteUrl = `https://zello.example/#/invite/${'a'.repeat(43)}`
function backend(data = page, conflict = false) {
  const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
    if (path.includes('/members?')) return Response.json(data)
    if (path.includes('/membership-history')) return Response.json({ items: [], page: 1, hasNext: false })
    if (path.includes('/invitations?')) return Response.json({ items: [invitation], total: 1, page: 1, hasNext: false })
    if (path.endsWith('/invitations') && init?.method === 'POST') return Response.json({ invitation, inviteUrl }, { status: 201 })
    if (conflict && init?.method === 'PATCH') return Response.json({ code: 'MEMBERSHIP_CHANGED', message: '멤버 정보가 변경됐어요.' }, { status: 409 })
    if (init?.method === 'PATCH') return Response.json(member)
    if (init?.method === 'DELETE' || path.endsWith('/ownership')) return new Response(null, { status: 204 })
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetcher)
  return fetcher
}
const mount = (onLeft = vi.fn()) => render(<MemoryRouter><MembersPanel projectId="9" onLeft={onLeft} /></MemoryRouter>)

describe('실제 프로젝트의 멤버와 권한', () => {
  it('기본 초대 권한은 멤버이며 CSRF로 지정 계정과 유효 기간을 전송한다', async () => {
    const fetcher = backend(); mount()
    const user = userEvent.setup()
    await screen.findByRole('button', { name: '초대 링크 만들기' })
    expect(screen.getByRole('combobox', { name: '참여 권한' })).toHaveValue('MEMBER')
    await user.type(screen.getByLabelText('초대받을 GitHub 아이디 · 선택'), '@octocat')
    await user.click(screen.getByRole('button', { name: '초대 링크 만들기' }))
    expect(await screen.findByLabelText('생성한 초대 링크')).toHaveValue(inviteUrl)
    expect(fetcher).toHaveBeenCalledWith('/api/projects/9/invitations', expect.objectContaining({ method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': 'csrf' }, body: JSON.stringify({ role: 'MEMBER', expiresInHours: 72, githubLogin: 'octocat' }) }))
    expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('a'.repeat(43))
    await user.click(screen.getByRole('button', { name: '초대 7 취소' }))
    await waitFor(() => expect(screen.queryByLabelText('생성한 초대 링크')).not.toBeInTheDocument())
  })
  it('조회자는 멤버만 조회하고 초대, 권한 변경, 소유권 이전을 표시하지 않는다', async () => {
    const fetcher = backend({ ...page, canInvite: false, canInviteAdmin: false, items: [{ ...member, self: true, canChangeRole: false, canRemove: false, canTransferTo: false }] })
    mount(); await screen.findByText('@teammate')
    expect(screen.queryByRole('button', { name: '초대 링크 만들기' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'teammate 권한 변경' })).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([path]) => path.includes('/invitations'))).toBe(false)
    expect(screen.getByRole('button', { name: '프로젝트 나가기' })).toBeEnabled()
  })
  it('소유자는 나갈 수 없고 확인을 취소하면 내보내기 요청을 보내지 않는다', async () => {
    const fetcher = backend(); mount(); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'teammate 내보내기' }))
    expect(screen.getByRole('button', { name: '프로젝트 나가기' })).toBeDisabled()
    const dialog = screen.getByRole('dialog', { name: '멤버 내보내기' })
    expect(dialog).toHaveFocus()
    await user.click(within(dialog).getByRole('button', { name: '취소', exact: true }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false)
  })
  it('권한 변경은 멤버 버전을 보내고 충돌하면 재시도 대신 최신 목록을 요구한다', async () => {
    const fetcher = backend(page, true); mount(); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'teammate 권한 변경' }))
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: '변경할 권한' }), 'VIEWER')
    await user.click(within(dialog).getByRole('button', { name: '멤버 권한 변경', exact: true }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('멤버 정보가 변경됐어요.')
    expect(within(dialog).getByRole('button', { name: '멤버 권한 변경', exact: true })).toBeDisabled()
    expect(fetcher).toHaveBeenCalledWith('/api/projects/9/members/2', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ role: 'VIEWER', version: 4 }) }))
    await user.click(within(dialog).getByRole('button', { name: '최신 목록 다시 확인' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('소유권 이전은 대상 멤버와 프로젝트의 두 버전을 확인 후 보낸다', async () => {
    const fetcher = backend(); mount(); const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'teammate에게 소유권 이전' }))
    expect(fetcher.mock.calls.some(([path]) => path.endsWith('/ownership'))).toBe(false)
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '프로젝트 소유권 이전' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/projects/9/ownership', expect.objectContaining({ method: 'POST', body: JSON.stringify({ userId: '2', projectVersion: 8, memberVersion: 4 }) })))
  })
  it('나가기를 확인하면 내 멤버 버전으로 탈퇴하고 프로젝트 목록을 갱신한다', async () => {
    const fetcher = backend({ ...page, canInvite: false, canInviteAdmin: false }); const onLeft = vi.fn(); mount(onLeft)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: '프로젝트 나가기' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '프로젝트 나가기' }))
    await waitFor(() => expect(onLeft).toHaveBeenCalledOnce())
    expect(fetcher).toHaveBeenCalledWith('/api/projects/9/membership?version=3', expect.objectContaining({ method: 'DELETE' }))
  })
})

describe('프로젝트 기본 설정', () => {
  it('실제 프로젝트의 버전으로 이름과 설명을 저장한다', async () => {
    const project = { id: '9', name: '기존 이름', description: '설명', role: 'OWNER', canManageRepositories: true, version: 8 }
    const fetcher = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/auth/csrf') return Response.json({ headerName: 'X-CSRF-TOKEN', token: 'csrf' })
      return Response.json(init?.method === 'PATCH' ? { ...project, ...JSON.parse(init.body as string), version: 9 } : project)
    })
    vi.stubGlobal('fetch', fetcher)
    render(<ProjectGeneralSettings projectId="9" />)
    const name = await screen.findByRole('textbox', { name: '프로젝트 이름' }); const user = userEvent.setup()
    await user.clear(name); await user.type(name, '새 이름')
    await user.click(screen.getByRole('button', { name: '설정 저장' }))
    expect(await screen.findByRole('status')).toHaveTextContent('프로젝트 정보를 저장했어요.')
    expect(fetcher).toHaveBeenCalledWith('/api/projects/9', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ version: 8, name: '새 이름', description: '설명' }) }))
  })
})
