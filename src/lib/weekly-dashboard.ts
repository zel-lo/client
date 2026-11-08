export type DashboardTask = { id: string; title: string; type: 'ISSUE' | 'PR'; status: string; repository: string }
export type DashboardPerson = { login: string; name: string; avatarUrl: string | null; jobTitle: string | null; inProgress: number; reviewing: number; completed: number; assigned: number; tasks: DashboardTask[] }
export type DashboardAttention = { id: string; kind: 'UNASSIGNED' | 'REVIEW_AGING' | 'CHANGES_REQUESTED'; title: string; repository: string; owner: string | null; ageDays: number | null; timeLabel: string; reviewers: string[] }
export type DashboardCompleted = { id: string; type: 'ISSUE' | 'PR'; title: string; owner: string | null; repository: string; completedAt: string; needsTitle: boolean }
export type WeeklyDashboard = {
  weekStart: string; weekEnd: string; periodLabel: string; timezone: string
  total: number; completed: number; percentage: number; carriedOver: number; completedThisWeek: number
  states: Record<string, number>; attentionCounts: { unassigned: number; reviewAging: number; changesRequested: number }
  attention: DashboardAttention[]; people: DashboardPerson[]; recent: DashboardCompleted[]; recentTotal: number; fetchedAt: string
  currentWeek?: string; projectStartDate?: string | null; projectEndDate?: string | null
}
export const dashboardTaskPath = (task: Pick<DashboardTask, 'id' | 'type'>) => task.type === 'PR' ? `/pull-requests?pr=${encodeURIComponent(task.id)}` : `/issues?issue=${encodeURIComponent(task.id)}`
