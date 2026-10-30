import { request } from './session-api'

export type Project = { id: string; name: string; description: string | null; role: string; canManageRepositories: boolean }
export type GitHubAccount = { id: string; login: string; type: 'USER' | 'ORGANIZATION' }
export type RepositoryOption = { id: string; fullName: string; owner: string; ownerType: string; privateRepository: boolean; archived: boolean }
export type ConnectedRepository = {
  id: string; projectId: string; githubRepositoryId: string; installationId: string | null
  owner: string; name: string; htmlUrl: string; description: string | null; language: string | null
  defaultBranch: string; privateRepository: boolean; status: string; initialSyncCompleted: boolean
}
export type Page<T> = { items: T[]; page: number; hasNext: boolean }

export class ProjectApiError extends Error {
  constructor(message: string, readonly code: string) { super(message) }
}

async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await request(path, options)
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { code?: string; message?: string } | null
    throw new ProjectApiError(error?.message ?? '요청을 처리하지 못했어요. 다시 시도해 주세요.', error?.code ?? 'REQUEST_FAILED')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

async function mutate<T>(path: string, method: 'POST' | 'DELETE', body?: unknown): Promise<T> {
  const csrf = await json<{ headerName: string; token: string }>('/api/auth/csrf')
  return json<T>(path, { method, headers: { 'Content-Type': 'application/json', [csrf.headerName]: csrf.token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}

export const listProjects = (signal?: AbortSignal) => json<Project[]>('/api/projects', { signal })
export const createProject = (name: string) => mutate<Project>('/api/projects', 'POST', { name })
export const listGitHubAccounts = (page: number, signal?: AbortSignal) =>
  json<Page<GitHubAccount>>(`/api/github/accounts?page=${page}`, { signal })
export const listAvailableRepositories = (account: string, page: number, signal?: AbortSignal) => {
  const params = new URLSearchParams({ page: String(page), scope: account.startsWith('organization:') ? 'organization' : account })
  if (account.startsWith('organization:')) params.set('organization', account.slice('organization:'.length))
  return json<Page<RepositoryOption>>(`/api/github/repositories?${params}`, { signal })
}
export const listConnectedRepositories = (projectId: string, signal?: AbortSignal) =>
  json<ConnectedRepository[]>(`/api/projects/${encodeURIComponent(projectId)}/repositories`, { signal })
export const connectRepository = (projectId: string, githubRepositoryId: string) =>
  mutate<ConnectedRepository>(`/api/projects/${encodeURIComponent(projectId)}/repositories`, 'POST', { githubRepositoryId })
export const disconnectRepository = (projectId: string, repositoryId: string) =>
  mutate<void>(`/api/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(repositoryId)}`, 'DELETE')
