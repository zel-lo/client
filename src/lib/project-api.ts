import { request } from './session-api'

export type Project = { id: string; name: string; description: string | null; role: string; canManageRepositories: boolean; version?: number }
export type GitHubAccount = { id: string; login: string; type: 'USER' | 'ORGANIZATION' }
export type RepositoryOption = { id: string; fullName: string; owner: string; ownerType: string; privateRepository: boolean; archived: boolean }
export type ConnectedRepository = {
  id: string; projectId: string; githubRepositoryId: string; installationId: string | null
  owner: string; name: string; htmlUrl: string; description: string | null; language: string | null
  defaultBranch: string; privateRepository: boolean; status: string; initialSyncCompleted: boolean
}
export type Page<T> = { items: T[]; page: number; hasNext: boolean }
export type PullRequestItem = {
  id: string; repositoryId: string; repositoryOwner: string; repositoryName: string; number: number; url: string; title: string
  headBranch: string; baseBranch: string; state: 'OPEN' | 'CLOSED' | 'MERGED'; draft: boolean
  reviewDecision: 'UNKNOWN' | 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED'; teamSummary: string | null
  author: { login: string; avatarUrl: string | null } | null; reviewers: Reviewer[]; version: number
  /** 변경 규모. 상세를 열 때 GitHub에서 받아 오며, 아직 없으면 null. */
  changedFiles: number | null; additions: number | null; deletions: number | null
  openedAt: string | null; mergedAt: string | null; githubUpdatedAt: string | null
  /** GitHub 원본 본문. 상세 응답에만 있다. */
  body?: string
  /** PR은 만들었지만 리뷰어 지정만 실패했을 때 담긴다. */
  warning?: string
}
export type Reviewer = { login: string; avatarUrl: string | null }
export type ReviewerCandidates = { users: Reviewer[]; hasMore: boolean }
/** 이슈 목록(IssuePage)과 같은 형식. counts는 탭별 전체 개수로 검토 상태 필터와 상관없다. */
export type PullRequestPage = Page<PullRequestItem> & { total: number; counts: { open: number; merged: number; closed: number } }
export type PullRequestQuery = {
  state?: 'open' | 'merged' | 'closed' | 'all'; author?: 'me'; reviewer?: 'me'; review?: 'pending' | 'changes_requested'; page?: number; size?: number
}
export type BranchList = { defaultBranch: string; branches: string[]; hasMore: boolean }
export type NewPullRequest = {
  repositoryId: string; title: string; headBranch: string; baseBranch: string; teamSummary: string; body: string; draft: boolean
  requestKey: string; reviewers: string[]
}
export type PullRequestSync ={ collected: number; skippedRepositories: number; syncedAt: string }

export class ProjectApiError extends Error {
  constructor(message: string, readonly code: string) { super(message) }
}

export async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await request(path, options)
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { code?: string; message?: string } | null
    throw new ProjectApiError(error?.message ?? '요청을 처리하지 못했어요. 다시 시도해 주세요.', error?.code ?? 'REQUEST_FAILED')
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

export async function mutate<T>(path: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<T> {
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
export const listPullRequests = (projectId: string, options: PullRequestQuery = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams({ state: options.state ?? 'all', size: String(options.size ?? 100) })
  if (options.page && options.page > 1) params.set('page', String(options.page))
  if (options.author) params.set('author', options.author)
  if (options.reviewer) params.set('reviewer', options.reviewer)
  if (options.review) params.set('review', options.review)
  return json<PullRequestPage>(`/api/projects/${encodeURIComponent(projectId)}/pull-requests?${params}`, { signal })
}
export const getPullRequest = (projectId: string, pullRequestId: string, signal?: AbortSignal) =>
  json<PullRequestItem>(`/api/projects/${encodeURIComponent(projectId)}/pull-requests/${encodeURIComponent(pullRequestId)}`, { signal })
export const listBranches = (projectId: string, repositoryId: string, signal?: AbortSignal) =>
  json<BranchList>(`/api/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(repositoryId)}/branches`, { signal })
export const listReviewerCandidates = (projectId: string, repositoryId: string, signal?: AbortSignal) =>
  json<ReviewerCandidates>(`/api/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(repositoryId)}/reviewer-candidates`, { signal })
export const updateTeamSummary = (projectId: string, pullRequestId: string, teamSummary: string, version: number) =>
  mutate<PullRequestItem>(`/api/projects/${encodeURIComponent(projectId)}/pull-requests/${encodeURIComponent(pullRequestId)}`, 'PATCH', { teamSummary, version })
export const createPullRequest = (projectId: string, input: NewPullRequest) =>
  mutate<PullRequestItem>(`/api/projects/${encodeURIComponent(projectId)}/pull-requests`, 'POST', input)
export const syncPullRequests = (projectId: string) =>
  mutate<PullRequestSync>(`/api/projects/${encodeURIComponent(projectId)}/pull-requests/sync`, 'POST')
export const disconnectRepository = (projectId: string, repositoryId: string) =>
  mutate<void>(`/api/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(repositoryId)}`, 'DELETE')

export const githubAuthorization = (signal?: AbortSignal) => json<{ organizationAccessUrl: string | null }>('/api/github/authorization', { signal })
export type IssueDetails = {
  title: string; description: string; status: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
  priority: 'HIGH' | 'MEDIUM' | 'LOW'; source: 'DAILY' | 'WEEKLY' | 'REQUEST' | 'GITHUB'
  meetingDate: string | null; meetingContext: string; acceptanceCriteria: string; assignee: string | null
}
export type LiveIssue = IssueDetails & {
  id: string; version: number; key: string; repositoryId: string; repositoryOwner: string; repositoryName: string
  number: number; url: string; githubState: 'OPEN' | 'CLOSED' | null; archived: boolean; publishStatus: 'LOCAL' | 'PENDING' | 'PUBLISHED' | 'FAILED' | 'UNKNOWN'; lastPublishError: string | null
}
export type IssuePage = Page<LiveIssue> & { total: number }
export const listIssues = (projectId: string, options: { page?: number; query?: string; status?: string; mine?: boolean; archived?: boolean; activeOnly?: boolean } = {}, signal?: AbortSignal) => {
  const params = new URLSearchParams({ page: String(options.page ?? 1), size: '30', query: options.query ?? '', mine: String(options.mine ?? false), activeOnly: String(options.activeOnly ?? false), archived: String(options.archived ?? false) })
  if (options.status) params.set('status', options.status)
  return json<IssuePage>(`/api/projects/${encodeURIComponent(projectId)}/issues?${params}`, { signal })
}
export const getIssue = (projectId: string, id: string, signal?: AbortSignal) => json<LiveIssue>(`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(id)}`, { signal })
export const createIssue = (projectId: string, repositoryId: string, details: IssueDetails, requestKey: string) => mutate<LiveIssue>(`/api/projects/${encodeURIComponent(projectId)}/issues`, 'POST', { repositoryId, details, requestKey })
export const updateIssue = (projectId: string, issue: LiveIssue, details: IssueDetails, githubState: LiveIssue['githubState']) => mutate<LiveIssue>(`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issue.id)}`, 'PATCH', { version: issue.version, details, githubState: githubState ?? 'OPEN' })
export const archiveIssue = (projectId: string, issue: LiveIssue) => mutate<void>(`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issue.id)}?version=${issue.version}`, 'DELETE')
export const restoreIssue = (projectId: string, issue: LiveIssue) => mutate<void>(`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issue.id)}/restore?version=${issue.version}`, 'POST')
export const syncIssues = (projectId: string) => mutate<{ collected: number; skippedRepositories: number; hasMore: boolean }>(`/api/projects/${encodeURIComponent(projectId)}/issues/sync`, 'POST')
export const listAssignees = (projectId: string, repositoryId: string, page = 1, signal?: AbortSignal) => json<Page<{ id: number; login: string }>>(`/api/projects/${encodeURIComponent(projectId)}/repositories/${encodeURIComponent(repositoryId)}/assignees?page=${page}`, { signal })

export const publishIssue = (projectId: string, issue: LiveIssue) => mutate<LiveIssue>(`/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issue.id)}/publish`, 'POST', { version: issue.version })
