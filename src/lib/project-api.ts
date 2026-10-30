import { request } from './session-api'

export type Project = { id: string; name: string; description: string | null; role: string; canManageRepositories: boolean }
export type Installation = { id: string; owner: string; ownerType: 'User' | 'Organization' }
export type RepositoryOption = { id: string; fullName: string; privateRepository: boolean; archived: boolean }
export type ConnectedRepository = {
  id: string; projectId: string; githubRepositoryId: string; installationId: string
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
export const githubConfiguration = (signal?: AbortSignal) => json<{ installUrl: string | null }>('/api/github/config', { signal })
export const listInstallations = (page: number, signal?: AbortSignal) => json<Page<Installation>>(`/api/github/installations?page=${page}`, { signal })
export const listAvailableRepositories = (installationId: string, page: number, signal?: AbortSignal) =>
  json<Page<RepositoryOption>>(`/api/github/installations/${encodeURIComponent(installationId)}/repositories?page=${page}`, { signal })
export const listConnectedRepositories = (projectId: string, signal?: AbortSignal) =>
  json<ConnectedRepository[]>(`/api/projects/${encodeURIComponent(projectId)}/repositories`, { signal })
export const connectRepository = (projectId: string, githubInstallationId: string, githubRepositoryId: string) =>
  mutate<ConnectedRepository>(`/api/projects/${encodeURIComponent(projectId)}/repositories`, 'POST', { githubInstallationId, githubRepositoryId })
export const disconnectRepository = (projectId: string, repositoryId: string) =>
  mutate<void>(`/api/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(repositoryId)}`, 'DELETE')
