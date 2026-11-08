import { useSearchParams } from 'react-router-dom'
import { completionDate, isCalendarDate, shiftWeek, startOfWeek } from '../lib/work-weeks'
import type { Issue, PullRequest } from '../data/work-items'
import { activities, members, initialRepos } from '../data/mock'
import type { DashboardAttention, DashboardCompleted, DashboardTask, WeeklyDashboard } from '../lib/weekly-dashboard'
import { WeeklyDashboardView } from './weekly-overview'

/** The existing sample project uses the same view as a signed-in project. */
export function DemoWeeklyOverview({ issues, pullRequests, onIssue, onPr }: { issues: Issue[]; pullRequests: PullRequest[]; onIssue: (issue: Issue) => void; onPr: (pr: PullRequest) => void }) {
  const [params, setParams] = useSearchParams()
  const currentWeek = '2026-10-26'
  const requested = params.get('week')
  const week = requested && isCalendarDate(requested) ? startOfWeek(requested) : currentWeek
  const end = new Date(Date.parse(shiftWeek(week, 1)) - 86400000).toISOString().slice(0, 10)
  const inWeek = (date: string | null | undefined) => !!date && date >= week && date <= end
  const completedAt = (issue: Issue) => {
    const pull = pullRequests.find(pr => issue.pullRequestIds.includes(pr.id) && pr.status === 'merged')
    const activity = activities.find(a => a.id === pull?.activityId)
    return issue.completedAt ?? `${activity?.date ?? '2026-10-27'}T12:00:00`
  }
  const doneIssues = issues.filter(issue => issue.status === 'done' && inWeek(completionDate(completedAt(issue))))
  const repoName = (id: string) => initialRepos.find(repo => repo.id === id)?.name ?? id
  const scope = issues.filter(issue => issue.status !== 'backlog' && (issue.plannedWeekStart ?? startOfWeek(issue.meetingDate ?? week)) <= week && (issue.status !== 'done' || inWeek(completionDate(completedAt(issue)))))
  const open = pullRequests.filter(pr => pr.status === 'open' && (activities.find(a => a.id === pr.activityId)?.date ?? '2026-10-30') <= end)
  const attention: DashboardAttention[] = open.flatMap(pr => {
    const activity = activities.find(a => a.id === pr.activityId)
    const days = activity ? Math.max(0, Math.floor((Date.parse('2026-10-30') - Date.parse(activity.date)) / 86400000)) : null
    if (pr.review !== 'changes_requested' && !(pr.review === 'pending' && days !== null && days >= 3)) return []
    return [{ id: pr.id, kind: pr.review === 'changes_requested' ? 'CHANGES_REQUESTED' : 'REVIEW_AGING', title: pr.title, repository: repoName(pr.repo), owner: pr.author, ageDays: pr.review === 'changes_requested' ? null : days, timeLabel: pr.review === 'changes_requested' ? '수정 요청' : `PR 열린 지 ${days}일`, reviewers: pr.reviewers ?? [] }]
  })
  scope.filter(issue => issue.status !== 'done' && !issue.assignee).forEach(issue => attention.push({ id: issue.id, kind: 'UNASSIGNED', title: issue.title, repository: repoName(issue.repo), owner: null, ageDays: null, timeLabel: '담당자 지정 필요', reviewers: [] }))
  const completed: DashboardCompleted[] = doneIssues.map(issue => {
    const pull = pullRequests.find(p => issue.pullRequestIds.includes(p.id) && p.status === 'merged')
    const activity = activities.find(a => a.id === pull?.activityId)
    return { id: issue.id, type: 'ISSUE', title: activity?.title ?? issue.title, owner: issue.assignee || null, repository: repoName(issue.repo), completedAt: completedAt(issue), needsTitle: false }
  })
  pullRequests.filter(pr => pr.status === 'merged' && !issues.some(issue => issue.pullRequestIds.includes(pr.id))).forEach(pr => {
    const activity = activities.find(a => a.id === pr.activityId)
    if (activity && inWeek(activity.date)) completed.push({ id: pr.id, type: 'PR', title: activity.title, owner: pr.author, repository: repoName(pr.repo), completedAt: `${activity.date}T12:00:00`, needsTitle: false })
  })
  const people = members.map(member => {
    const owned = scope.filter(issue => issue.assignee === member.name)
    const assigned = owned.filter(issue => issue.status !== 'done')
    const reviewing = open.filter(pr => pr.reviewers?.includes(member.name) && pr.review === 'pending')
    const tasks: DashboardTask[] = assigned.map(issue => ({ id: issue.id, type: 'ISSUE', title: issue.title, status: issue.status.toUpperCase(), repository: repoName(issue.repo) }))
    reviewing.forEach(pr => tasks.push({ id: pr.id, type: 'PR', title: pr.title, status: 'REVIEW_REQUESTED', repository: repoName(pr.repo) }))
    return { login: member.name, name: member.name, avatarUrl: null, jobTitle: member.role, inProgress: owned.filter(issue => issue.status === 'in_progress').length, reviewing: reviewing.length, completed: completed.filter(item => item.owner === member.name).length, assigned: assigned.length, tasks }
  })
  const done = scope.filter(issue => issue.status === 'done').length
  const data: WeeklyDashboard = { weekStart: week, weekEnd: end, currentWeek, periodLabel: week === currentWeek ? '이번 주' : week === shiftWeek(currentWeek, -1) ? '지난 주' : week === shiftWeek(currentWeek, 1) ? '다음 주' : '선택한 주', timezone: 'Asia/Seoul', total: scope.length, completed: done, percentage: scope.length ? Math.round(done / scope.length * 100) : 0,
    carriedOver: scope.filter(issue => issue.status !== 'done' && (issue.plannedWeekStart ?? startOfWeek(issue.meetingDate ?? week)) < week).length,
    completedThisWeek: completed.length, states: Object.fromEntries(['IN_PROGRESS', 'IN_REVIEW', 'DONE'].map(state => [state, scope.filter(issue => (issue.status === 'todo' ? 'IN_PROGRESS' : issue.status.toUpperCase()) === state).length])),
    attentionCounts: { unassigned: attention.filter(item => item.kind === 'UNASSIGNED').length, reviewAging: attention.filter(item => item.kind === 'REVIEW_AGING').length, changesRequested: attention.filter(item => item.kind === 'CHANGES_REQUESTED').length },
    attention, people, recent: completed.slice(0, 5), recentTotal: completed.length, fetchedAt: '2026-10-30T00:00:00' }
  return <WeeklyDashboardView key={week} data={data} demo onWeekChange={value => setParams(current => { const next = new URLSearchParams(current); if (value === currentWeek) next.delete('week'); else next.set('week', value); return next })} onOpen={task => { if (task.type === 'ISSUE') { const issue = issues.find(item => item.id === task.id); if (issue) onIssue(issue) } else { const pr = pullRequests.find(item => item.id === task.id); if (pr) onPr(pr) } }} />
}
