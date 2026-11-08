import { json, mutate } from './project-api'
export type Page<T> = { items: T[]; page: number; hasNext: boolean }
export type Activity = { id: string; type: string; title: string; summary: string | null; actor: string | null; repositoryId: string | null; issueId: string | null; pullRequestId: string | null; patchNoteId: string | null; occurredAt: string }
export type Notification = { id: string; title: string; body: string | null; readAt: string | null; activity: Activity }
export type WorkChange = { id: string; issueId: string | null; pullRequestId: string | null; title: string; summary: string; category: 'FEATURE' | 'FIX' | 'IMPROVE'; status: 'COMPLETED' | 'MERGED' | 'REOPENED' | 'ARCHIVED' | 'CONSOLIDATED'; occurredAt: string; needsTitle: boolean }
export type Note = { id: string; title: string; summary: string; status: string; version: number; author: string; publishedAt: string | null; createdAt?: string; automatic?: boolean; changes?: WorkChange[] }
export type Summary = { issues: Record<string, number>; mine: number; unread: number; repositories: number; contributions: { date: string; count: number }[] }
export const workspaceGet = <T,>(project: string, path: string, signal?: AbortSignal) => json<T>(`/api/projects/${encodeURIComponent(project)}/${path}`, { signal })
export const readNotification = (project: string, id: string, read: boolean) => mutate<void>(`/api/projects/${project}/notifications/${id}`, 'PATCH', { read })
export const readAllNotifications = (project: string) => mutate<void>(`/api/projects/${project}/notifications/read-all`, 'POST')
export const saveNote = (project: string, input: { title: string; summary: string; publish: boolean; version?: number }, id?: string) => mutate<Note>(`/api/projects/${project}/patch-notes${id ? `/${id}` : ''}`, id ? 'PATCH' : 'POST', input)
export const changed = () => window.dispatchEvent(new Event('zello:workspace-updated'))

export const collectWorkChanges = (project: string) => mutate<void>(`/api/projects/${project}/patch-notes/collect`, 'POST')
export const saveChangeTitle = (project: string, note: string, change: string, title: string, version: number) => mutate<Note>(`/api/projects/${project}/patch-notes/${note}/changes/${change}`, 'PATCH', { title, version })
