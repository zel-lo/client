import { json, mutate } from './project-api'
import type { Project } from './project-api'

export type MemberRole = 'ADMIN' | 'MEMBER' | 'VIEWER'
export const roleLabels = { OWNER: '소유자', ADMIN: '관리자', MEMBER: '멤버', VIEWER: '조회자' }
export type Member = {
  userId: string; githubId: string; login: string; displayName: string; avatarUrl: string | null
  role: keyof typeof roleLabels; version: number; joinedAt: string; self: boolean
  canChangeRole: boolean; canRemove: boolean; canTransferTo: boolean
}
export type MembersPage = {
  items: Member[]; total: number; page: number; hasNext: boolean; projectName: string; projectVersion: number
  ownerUserId: string; currentMemberVersion: number; canInvite: boolean; canInviteAdmin: boolean
}
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED'
export type Invitation = {
  id: string; role: MemberRole; expiresAt: string; createdAt: string; status: InvitationStatus
  createdBy: string; targetLogin: string | null; acceptedByUserId: string | null
}
export type InvitationsPage = { items: Invitation[]; page: number; hasNext: boolean; total: number }
export type CreatedInvitation = { invitation: Invitation; inviteUrl: string }
export type InvitationPreview = {
  projectId: string; projectName: string; role: MemberRole; invitedBy: string; expiresAt: string
  status: InvitationStatus; alreadyMember: boolean; canAccept: boolean
}
export type History = { items: { id: string; type: string; title: string; summary: string | null; actorLogin: string | null; occurredAt: string }[]; page: number; hasNext: boolean }
const projectPath = (id: string) => `/api/projects/${encodeURIComponent(id)}`
export const listMembers = (id: string, query = '', page = 1, signal?: AbortSignal) => json<MembersPage>(`${projectPath(id)}/members?${new URLSearchParams({ query, page: String(page), size: '30' })}`, { signal })
export const listInvitations = (id: string, page = 1, signal?: AbortSignal) => json<InvitationsPage>(`${projectPath(id)}/invitations?page=${page}&size=20`, { signal })
export const createInvitation = (id: string, role: MemberRole, expiresInHours: number, githubLogin: string | null) => mutate<CreatedInvitation>(`${projectPath(id)}/invitations`, 'POST', { role, expiresInHours, githubLogin })
export const revokeInvitation = (id: string, invitationId: string) => mutate<void>(`${projectPath(id)}/invitations/${encodeURIComponent(invitationId)}`, 'DELETE')
export const previewInvitation = (token: string, signal?: AbortSignal) => mutatePreview(token, signal)
async function mutatePreview(token: string, signal?: AbortSignal) {
  const csrf = await json<{ headerName: string; token: string }>('/api/auth/csrf', { signal })
  return json<InvitationPreview>('/api/invitations/preview', { method: 'POST', signal, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token }, body: JSON.stringify({ token }) })
}
export const acceptInvitation = (token: string) => mutate<{ project: Project; alreadyMember: boolean }>('/api/invitations/accept', 'POST', { token })
export const changeMemberRole = (id: string, member: Member, role: MemberRole) => mutate<Member>(`${projectPath(id)}/members/${encodeURIComponent(member.userId)}`, 'PATCH', { role, version: member.version })
export const removeMember = (id: string, member: Member) => mutate<void>(`${projectPath(id)}/members/${encodeURIComponent(member.userId)}?version=${member.version}`, 'DELETE')
export const leaveProject = (id: string, version: number) => mutate<void>(`${projectPath(id)}/membership?version=${version}`, 'DELETE')
export const transferProject = (id: string, member: Member, projectVersion: number) => mutate<void>(`${projectPath(id)}/ownership`, 'POST', { userId: member.userId, projectVersion, memberVersion: member.version })
export const membershipHistory = (id: string, page = 1, signal?: AbortSignal) => json<History>(`${projectPath(id)}/membership-history?page=${page}&size=20`, { signal })
export const updateProject = (id: string, version: number, name: string, description: string) => mutate<Project>(projectPath(id), 'PATCH', { version, name, description })
export const projectDetail = (id: string, signal?: AbortSignal) => json<Project>(projectPath(id), { signal })
export function memberDate(value: string) {
  const date = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`)
  return Number.isNaN(date.getTime()) ? '시각 확인 중' : date.toLocaleString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
