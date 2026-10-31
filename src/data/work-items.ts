import type { PullRequestItem } from '../lib/project-api'

/** Product records are separate from the historical activity feed. */
export type IssueStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'
export type IssueSource = 'daily' | 'weekly' | 'request' | 'github'
export const issueSources: Record<IssueSource, string> = { daily: '데일리 스크럼', weekly: '주간 회의', request: '수시 요청', github: 'GitHub에서 수집' }
export const CURRENT_USER = '이수빈'
export type IssuePriority = 'high' | 'medium' | 'low'
export type Issue = {
  id: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  assignee: string
  repo: string
  pullRequestIds: string[]
  githubNumber?: number
  source?: IssueSource
  meetingDate?: string
  acceptanceCriteria?: string
}
export type PullRequest = {
  id: string
  number: number
  activityId?: number
  repo: string
  title: string
  author: string
  branch: string
  base: string
  status: 'open' | 'merged' | 'closed' | 'draft'
  review: 'pending' | 'approved' | 'changes_requested'
  checks: 'passing' | 'failing' | 'running' | 'unknown'
  summary?: string
  reviewers?: string[]
  url?: string
  live?: boolean
  projectId?: string
}
export const issueStatuses: Record<IssueStatus, string> = {
  backlog: '백로그', todo: '할 일', in_progress: '진행 중', in_review: '검토 중', done: '완료',
}
export const issuePriorities: Record<IssuePriority, string> = { high: '높음', medium: '보통', low: '낮음' }
export const initialIssues: Issue[] = [
  { id: 'ZELLO-42', title: '컬렉션 검색 응답 속도 개선', description: '검색 결과를 더 빠르게 확인할 수 있도록 쿼리와 응답 시간을 개선합니다.', status: 'in_review', priority: 'high', assignee: '박지훈', repo: 'api', pullRequestIds: ['api-87'], githubNumber: 86, source: 'daily', meetingDate: '2026-10-27', acceptanceCriteria: '검색 결과가 기존보다 빠르게 표시되고 기존 검색 동작을 유지한다.' },
  { id: 'ZELLO-43', title: '키보드만으로 메뉴와 대화상자 사용', description: '메뉴 이동, 포커스 표시와 대화상자의 키보드 접근성을 개선합니다.', status: 'in_progress', priority: 'high', assignee: '최민준', repo: 'design', pullRequestIds: ['design-32'], githubNumber: 31, source: 'daily', meetingDate: '2026-10-26', acceptanceCriteria: 'Tab과 Enter로 메뉴를 조작할 수 있고 키보드 접근성 검사를 통과한다.' },
  { id: 'ZELLO-44', title: '컬렉션 공동 편집', description: '팀원이 같은 컬렉션에 자료를 추가하고 정리할 수 있도록 공동 편집 기능을 기획합니다.', status: 'backlog', priority: 'medium', assignee: '', repo: 'web', pullRequestIds: [], githubNumber: 132, source: 'weekly', meetingDate: '2026-10-26', acceptanceCriteria: '공동 편집의 권한과 초대 방식, 첫 개발 범위를 정한다.' },
  { id: 'ZELLO-45', title: '비어 있는 컬렉션의 첫 사용 안내', description: '아직 자료가 없는 컬렉션에서 첫 링크를 저장하는 방법을 안내합니다.', status: 'todo', priority: 'low', assignee: '이수빈', repo: 'web', pullRequestIds: ['web-118'], githubNumber: 117, source: 'weekly', meetingDate: '2026-10-20', acceptanceCriteria: '비어 있는 컬렉션에서 첫 링크를 저장하는 동선을 안내한다.' },
  { id: 'ZELLO-41', title: '컬렉션 링크 공유', description: '로그인하지 않은 사람도 공유 링크로 컬렉션을 둘러볼 수 있도록 합니다.', status: 'done', priority: 'medium', assignee: '김서연', repo: 'web', pullRequestIds: ['web-128'], githubNumber: 124, source: 'weekly', meetingDate: '2026-10-19', acceptanceCriteria: '공유 링크를 받은 사람이 로그인하지 않아도 컬렉션을 볼 수 있다.' },
]
export const initialPullRequests: PullRequest[] = [
  { id: 'api-87', reviewers: [CURRENT_USER], number: 87, activityId: 127, repo: 'api', title: '검색 결과를 더 빠르게 불러오는 작업', author: '박지훈', branch: 'perf/search-query', base: 'main', status: 'open', review: 'pending', checks: 'passing' },
  { id: 'design-32', reviewers: ['김서연'], number: 32, activityId: 121, repo: 'design', title: '키보드로도 메뉴를 이동할 수 있도록', author: '최민준', branch: 'feat/keyboard-navigation', base: 'main', status: 'open', review: 'changes_requested', checks: 'failing' },
  { id: 'web-118', number: 118, activityId: 114, repo: 'web', title: '비어 있는 컬렉션에 안내를 추가해요', author: '김서연', branch: 'feat/empty-state', base: 'main', status: 'draft', review: 'pending', checks: 'running' },
  { id: 'web-128', number: 128, activityId: 128, repo: 'web', title: '컬렉션을 링크 하나로 공유할 수 있어요', author: '김서연', branch: 'feat/collection-share', base: 'main', status: 'merged', review: 'approved', checks: 'passing' },
  { id: 'api-85', number: 85, activityId: 123, repo: 'api', title: '저장한 링크가 사라지는 문제를 고쳤어요', author: '박지훈', branch: 'fix/duplicate-link', base: 'main', status: 'merged', review: 'approved', checks: 'passing' },
]

// Fill only metadata absent from earlier demo versions; preserve user edits.
export function hydrateIssue(issue: Issue): Issue {
  const seed = initialIssues.find(sample => sample.id === issue.id && sample.repo === issue.repo)
  return { source: 'request', acceptanceCriteria: '', ...seed, ...issue }
}
export function repositoryRef(repo: string, number: number | undefined, repos: { id: string; name: string }[], fallback = '') {
  const name = repos.find(item => item.id === repo)?.name ?? repo
  return number ? `${name}#${number}` : `${name} · ${fallback}`
}
export function nextRepositoryNumber(repo: string, issues: Issue[], pullRequests: PullRequest[]) {
  return Math.max(0, ...issues.filter(issue => issue.repo === repo).map(issue => issue.githubNumber ?? 0), ...pullRequests.filter(pr => pr.repo === repo).map(pr => pr.number)) + 1
}
export function issueAttention(issue: Issue, pullRequests: PullRequest[]) {
  if (issue.status === 'done') return '작업 완료'
  if (!issue.assignee) return '담당자 지정 필요'
  const linked = pullRequests.filter(pr => issue.pullRequestIds.includes(pr.id))
  if (!linked.length) return 'PR 연결 필요'
  if (linked.some(pr => pr.status === 'open' && (pr.checks === 'failing' || pr.review === 'changes_requested'))) return '수정 확인 필요'
  if (linked.some(pr => pr.status === 'open' && pr.review === 'pending')) return '코드 검토 대기'
  if (linked.every(pr => pr.status === 'merged')) return '병합됨 · 완료 확인 필요'
  return '개발 진행 중'
}

export function hydratePullRequest(pr: PullRequest): PullRequest {
  const seed = initialPullRequests.find(item => item.id === pr.id && item.repo === pr.repo)
  return { reviewers: seed?.reviewers ?? [], ...pr }
}
// repo에는 저장소 이름을 넣는다. repositoryRef가 목록에서 못 찾으면 이름 그대로 표시한다.
export function fromServerPullRequest(item: PullRequestItem, projectId?: string): PullRequest {
  const status = item.state === 'MERGED' ? 'merged' : item.state === 'CLOSED' ? 'closed' : item.draft ? 'draft' : 'open'
  const review = item.reviewDecision === 'APPROVED' ? 'approved' : item.reviewDecision === 'CHANGES_REQUESTED' ? 'changes_requested' : 'pending'
  return {
    id: item.id, number: item.number, repo: item.repositoryName, title: item.title, author: item.author?.login ?? '알 수 없음',
    branch: item.headBranch, base: item.baseBranch, status, review, checks: 'unknown', summary: item.teamSummary ?? undefined,
    reviewers: item.reviewers.map(reviewer => reviewer.login), url: item.url, live: true, projectId,
  }
}
export function needsMyReview(pr: PullRequest) {
  return pr.status === 'open' && pr.review === 'pending' && Boolean(pr.reviewers?.includes(CURRENT_USER))
}
