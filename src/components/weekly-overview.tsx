import { useState } from 'react'
import { initial } from '@/lib/utils'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, GitPullRequest, RefreshCw, RotateCcw, UserRound } from 'lucide-react'
import { useWorkspaceData } from '../hooks/use-workspace-data'
import { dashboardTaskPath } from '../lib/weekly-dashboard'
import type { WeeklyDashboard, DashboardTask, DashboardAttention, DashboardPerson } from '../lib/weekly-dashboard'
import { LoadingState } from './loading-state'
import { Dialog } from './workspace-dialog'
import { projectWeeks, projectWeekNumber, shiftWeek, startOfWeek, weekLabel } from '../lib/work-weeks'
import type { ProjectPeriod } from '../lib/work-weeks'
import './weekly-overview.css'

type OpenTask = (task: Pick<DashboardTask, 'id' | 'type'>) => void
const states = [{ key: 'IN_PROGRESS', label: '진행 중', tone: 'progress' }, { key: 'IN_REVIEW', label: '검토 중', tone: 'review' }, { key: 'DONE', label: '완료', tone: 'done' }]
const taskStates: Record<string, string> = { TODO: '진행 중', IN_PROGRESS: '진행 중', IN_REVIEW: '검토 중', REVIEW_REQUESTED: '리뷰 요청' }
const shortDate = (date: string) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}`

export function WeeklyOverview({ project }: { project: string }) {
  const [params, setParams] = useSearchParams()
  const requestedWeek = params.get('week')
  const result = useWorkspaceData<WeeklyDashboard>(project, `dashboard${requestedWeek ? `?week=${encodeURIComponent(requestedWeek)}` : ''}`)
  function selectWeek(week?: string) {
    setParams(current => {
      const next = new URLSearchParams(current)
      if (!week || week === result.data?.currentWeek) next.delete('week')
      else next.set('week', week)
      return next
    })
  }
  if (result.error && !result.data) return <div className="weekly-error" role="alert"><CircleHelp size={28} /><h2>주간 현황을 불러오지 못했어요</h2><p>{result.error}</p><button className="button" onClick={result.refresh}>다시 불러오기</button>{requestedWeek && <button className="weekly-text-link" onClick={() => selectWeek()}>이번 주로 돌아가기</button>}</div>
  if (!result.data) return <LoadingState layout="cards" label="선택한 주의 팀 작업을 모으고 있어요" />
  return <>{result.error && <p role="alert" className="connection-error">{result.error}</p>}<WeeklyDashboardView key={result.data.weekStart} data={result.data} refreshing={result.loading} onRefresh={result.refresh} onWeekChange={selectWeek} /></>
}

function DashboardWeekPicker({ data, onChange, disabled }: { data: WeeklyDashboard; onChange: (week: string) => void; disabled: boolean }) {
  const period: ProjectPeriod = { startDate: data.projectStartDate, endDate: data.projectEndDate }
  const current = data.currentWeek ?? data.weekStart
  const project = projectWeeks(period)
  const options = project.length ? project : [...new Set([
    ...Array.from({ length: 17 }, (_, index) => shiftWeek(current, index - 12)),
    ...Array.from({ length: 9 }, (_, index) => shiftWeek(data.weekStart, index - 4)),
  ])].sort().reverse()
  return <div className="weekly-week-picker" role="group" aria-label="조회 주차 선택">
    <button type="button" aria-label="이전 주" disabled={disabled || !!project.length && data.weekStart === project[0]} onClick={() => onChange(shiftWeek(data.weekStart, -1))}><ChevronLeft size={16} /></button>
    <label><CalendarDays size={15} /><select aria-label="조회 주차" value={data.weekStart} disabled={disabled} onChange={event => onChange(startOfWeek(event.target.value, period))}>{options.map(week => <option key={week} value={week}>{project.length ? `${projectWeekNumber(week, period)}주차 · ` : `${week.slice(0, 4)}년 · `}{weekLabel(week, period)}{week === current ? ' · 이번 주' : ''}</option>)}</select></label>
    <button type="button" aria-label="다음 주" disabled={disabled || !!project.length && data.weekStart === project.at(-1)} onClick={() => onChange(shiftWeek(data.weekStart, 1))}><ChevronRight size={16} /></button>
    {data.weekStart !== current && <button type="button" className="weekly-current-week" disabled={disabled} onClick={() => onChange(current)}>이번 주</button>}
  </div>
}

function TaskLink({ task, onOpen, className, children }: { task: Pick<DashboardTask, 'id' | 'type'>; onOpen?: OpenTask; className?: string; children: ReactNode }) {
  return onOpen ? <button type="button" className={className} onClick={() => onOpen(task)}>{children}</button> : <Link className={className} to={dashboardTaskPath(task)}>{children}</Link>
}

export function WeeklyDashboardView({ data, onOpen, onRefresh, onWeekChange, refreshing = false, demo = false }: { data: WeeklyDashboard; onOpen?: OpenTask; onRefresh?: () => void; onWeekChange?: (week: string) => void; refreshing?: boolean; demo?: boolean }) {
  const [filter, setFilter] = useState('ALL')
  const [allAttention, setAllAttention] = useState(false)
  const [allPeople, setAllPeople] = useState(false)
  const [assignment, setAssignment] = useState<DashboardPerson | null>(null)
  const attention = data.attention.filter(item => filter === 'ALL' || item.kind === filter)
  const shownAttention = allAttention ? attention : attention.slice(0, 4)
  const shownPeople = allPeople ? data.people : data.people.slice(0, 5)
  const weekQuery = `week=${encodeURIComponent(data.weekStart)}`
  const isCurrent = !data.currentWeek || data.weekStart === data.currentWeek
  const filters = [
    { key: 'ALL', label: '전체', count: data.attention.length },
    { key: 'UNASSIGNED', label: '담당자 없음', count: data.attentionCounts.unassigned },
    { key: 'REVIEW_AGING', label: '검토 기다림', count: data.attentionCounts.reviewAging },
    { key: 'CHANGES_REQUESTED', label: '수정 요청', count: data.attentionCounts.changesRequested },
  ]
  return <div className="weekly-dashboard" aria-label="주간 프로젝트 대시보드">
    <div className="weekly-period">{onWeekChange ? <DashboardWeekPicker data={data} onChange={onWeekChange} disabled={refreshing} /> : <span><CalendarDays size={15} />{shortDate(data.weekStart)} — {shortDate(data.weekEnd)}<i />{data.periodLabel}</span>}<div>{demo ? <span className="weekly-demo-label">샘플 데이터</span> : <button type="button" className="weekly-refresh" disabled={refreshing} onClick={onRefresh}><RefreshCw size={14} className={refreshing ? 'is-syncing' : ''} />{refreshing ? '불러오는 중' : '새로고침'}</button>}</div></div>

    <section className="weekly-card weekly-progress" aria-labelledby="weekly-progress-heading" data-tour="weekly-progress">
      <div className="weekly-progress-main">
        <div className="weekly-card-heading"><h2 id="weekly-progress-heading">{data.periodLabel} 진행률</h2><Link to={`/issues?${weekQuery}`} className="weekly-text-link">팀 작업 보기<ArrowUpRight size={14} /></Link></div>
        <div className="weekly-progress-number"><strong>{data.percentage}<span>%</span></strong><p>{data.total ? <><b>{data.total}개</b> 중 <b>{data.completed}개</b>를 마쳤어요</> : isCurrent ? '이번 주에 할 작업을 정해 보세요' : '해당 주차에 표시할 작업이 없어요'}</p></div>
        <div className="weekly-progress-track" role="progressbar" aria-label={`${data.periodLabel} 작업 완료율`} aria-valuenow={data.percentage} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${data.total}개 중 ${data.completed}개 완료`}>
          <span className="weekly-track-done" style={{ width: `${data.percentage}%` }} />
        </div>
        <div className="weekly-status-counts">{states.map(state => <Link key={state.key} to={`/issues?${weekQuery}&status=${state.key}`}><span><i className={`weekly-dot-${state.tone}`} />{state.label}</span><strong>{(data.states[state.key] ?? 0) + (state.key === 'IN_PROGRESS' ? data.states.TODO ?? 0 : 0)}<small>개</small></strong></Link>)}</div>
        <p className="weekly-progress-note">{isCurrent ? '이번 주 계획과 이전 주에서 이어온 작업 기준 · 백로그 제외' : '선택한 주 완료와 현재 미완료 작업 기준 · 백로그 제외'}</p>
      </div>
      <div className="weekly-highlights">
        <div><span className="weekly-highlight-icon is-done"><CheckCircle2 size={20} /></span><div><p>{data.periodLabel} 완료</p><strong>{data.completedThisWeek}<small>개</small></strong><span>팀이 마무리한 작업과 반영된 PR</span></div></div>
        <div><span className="weekly-highlight-icon is-carry"><RotateCcw size={19} /></span><div><p>이어온 작업</p><strong>{data.carriedOver}<small>개</small></strong><span>이전 주에 마치지 못한 작업</span></div></div>
      </div>
    </section>

    <div className="weekly-middle-grid">
      <section className="weekly-card weekly-attention" aria-labelledby="weekly-attention-heading" data-tour="weekly-attention">
        <div className="weekly-card-heading"><h2 id="weekly-attention-heading">먼저 확인해 주세요{data.attention.length > 0 && <span className="weekly-count">{data.attention.length}</span>}</h2>{!isCurrent && <span className="weekly-soft-label">현재 상태 기준</span>}</div>
        <div className="weekly-attention-filters" aria-label="확인할 작업 종류">{filters.map(item => <button key={item.key} type="button" aria-pressed={filter === item.key} onClick={() => { setFilter(item.key); setAllAttention(false) }}>{item.label}<span>{item.count}</span></button>)}</div>
        <div className="weekly-attention-list">{shownAttention.map(item => <AttentionRow key={`${item.kind}-${item.id}`} item={item} onOpen={onOpen} />)}</div>
        {!attention.length && <div className="weekly-clear-state"><span><Check size={24} /></span><strong>{filter === 'ALL' ? '지금은 순조롭게 진행 중이에요' : '확인이 필요한 항목이 없어요'}</strong><p>{filter === 'ALL' ? '담당자 없는 작업과 오래 기다린 PR이 없어요.' : '다른 항목에서도 팀의 상황을 확인해 보세요.'}</p></div>}
        {attention.length > 4 && <button type="button" className="weekly-show-more" aria-expanded={allAttention} onClick={() => setAllAttention(value => !value)}>{allAttention ? '간단히 보기' : `${attention.length - 4}개 더 보기`}<ChevronDown size={14} /></button>}
      </section>

      <section className="weekly-card weekly-people" aria-labelledby="weekly-people-heading" data-tour="weekly-people">
        <div className="weekly-card-heading"><h2 id="weekly-people-heading">업무 담당</h2><span className="weekly-soft-label">{data.people.length}명</span></div>
        <div className="weekly-people-table"><div className="weekly-assignment-heading" aria-hidden="true"><span>담당자</span><span>맡은 일</span><span /></div>
          {shownPeople.map((person, index) => <PersonRow key={person.login} person={person} index={index} onSelect={() => setAssignment(person)} />)}
        </div>
        {!data.people.length && <div className="weekly-clear-state"><UserRound size={26} /><strong>함께할 팀원을 초대해 보세요</strong><Link className="weekly-text-link" to="/settings?tab=members">멤버 관리<ArrowRight size={14} /></Link></div>}
        {data.people.length > 5 && <button type="button" className="weekly-show-more" aria-expanded={allPeople} onClick={() => setAllPeople(value => !value)}>{allPeople ? '간단히 보기' : `팀원 ${data.people.length - 5}명 더 보기`}<ChevronDown size={14} /></button>}
      </section>
    </div>

    <section className="weekly-card weekly-completed" aria-labelledby="weekly-completed-heading" data-tour="weekly-completed">
      <div className="weekly-card-heading"><h2 id="weekly-completed-heading">{data.periodLabel}, 이런 일을 마쳤어요<span className="weekly-count is-blue">{data.recentTotal}</span></h2><Link className="weekly-text-link" to="/changes">패치노트 보기<ArrowUpRight size={14} /></Link></div>
      <div className="weekly-completed-list">{data.recent.map(item => <TaskLink key={`${item.type}-${item.id}`} task={item} onOpen={onOpen} className="weekly-completed-row"><span className="weekly-complete-check"><Check size={16} strokeWidth={2.5} /></span><span className="weekly-row-copy"><strong>{item.title}</strong><small>{item.repository}<i />{item.owner ?? '담당자 없음'}{item.type === 'PR' && <><i />PR 병합</>}</small></span>{item.needsTitle && <span className="weekly-title-pending">반영 제목 미작성</span>}<time dateTime={item.completedAt}>{shortDate(new Date(item.completedAt.endsWith('Z') ? item.completedAt : item.completedAt + 'Z').toLocaleDateString('sv-SE', { timeZone: data.timezone }))}</time><ChevronRight size={15} /></TaskLink>)}</div>
      {!data.recent.length && <div className="weekly-completed-empty"><CheckCircle2 size={22} /><p>완료한 작업이 여기에 차곡차곡 모여요.</p><Link className="weekly-text-link" to={`/issues?${weekQuery}`}>팀 작업으로 이동<ArrowRight size={14} /></Link></div>}
    </section>
    {assignment && <Dialog title="업무 담당" drawer onClose={() => setAssignment(null)}><div className="weekly-assignment-detail">
      <div className="weekly-assignment-profile"><span className="weekly-avatar">{initial(assignment.name)}</span><div><h2>{assignment.name}</h2><p>{assignment.jobTitle ?? `@${assignment.login}`}</p></div></div>
      <h3>담당 업무</h3>
      {assignment.tasks.length ? <div className="weekly-assignment-tasks">{assignment.tasks.map(task => <TaskLink key={`${task.type}-${task.id}`} task={task} className="weekly-assignment-task" onOpen={onOpen ? selected => { setAssignment(null); onOpen(selected) } : undefined}><span className={`weekly-task-status is-${task.status.toLowerCase()}`}>{taskStates[task.status] ?? task.status}</span><strong>{task.title}</strong><small>{task.repository}</small><ChevronRight size={15} /></TaskLink>)}</div> : <p className="weekly-assignment-empty">현재 담당하고 있는 업무가 없어요.</p>}
      <Link className="button" to={`/issues?assignee=${encodeURIComponent(assignment.login)}&week=${encodeURIComponent(data.weekStart)}`}>담당 작업 모두 보기<ArrowUpRight size={14} /></Link>
    </div></Dialog>}
  </div>
}

function AttentionRow({ item, onOpen }: { item: DashboardAttention; onOpen?: OpenTask }) {
  const kind = item.kind === 'UNASSIGNED' ? 'unassigned' : item.kind === 'REVIEW_AGING' ? 'review' : 'changes'
  const Icon = item.kind === 'UNASSIGNED' ? UserRound : item.kind === 'REVIEW_AGING' ? Clock3 : GitPullRequest
  return <TaskLink task={{ id: item.id, type: item.kind === 'UNASSIGNED' ? 'ISSUE' : 'PR' }} onOpen={onOpen} className="weekly-attention-row">
    <span className={`weekly-attention-icon is-${kind}`}><Icon size={18} /></span><span className="weekly-row-copy"><span className={`weekly-reason is-${kind}`}>{item.timeLabel}</span><strong>{item.title}</strong><small>{item.repository}<i />{item.reviewers.length ? `${item.reviewers.join(', ')} 검토 대기` : item.owner ?? '담당자를 정해 주세요'}</small></span><ChevronRight size={16} />
  </TaskLink>
}

function PersonRow({ person, index, onSelect }: { person: DashboardPerson; index: number; onSelect: () => void }) {
  // 진행·검토 중은 맡은 작업의 단계, 리뷰 요청은 다른 사람 PR의 리뷰를 부탁받은 수
  const inReview = person.tasks.filter(task => task.type === 'ISSUE' && task.status === 'IN_REVIEW').length
  const load = ([['진행', person.inProgress, 'progress'], ['검토 중', inReview, 'review'], ['리뷰 요청', person.reviewing, 'request']] as const).filter(([, count]) => count > 0)
  return <button type="button" className="weekly-assignment-row" aria-label={`${person.name} 업무 담당 보기`} onClick={onSelect}>
    <span className="weekly-person-info"><span className={`weekly-avatar weekly-avatar-${index % 5}`}>{initial(person.name)}</span><strong>{person.name}</strong></span>
    <span className="weekly-assigned-work">{load.length ? load.map(([label, count, tone]) => <span key={label} className={`weekly-load is-${tone}`}>{label} {count}</span>) : <small>맡은 일 없음</small>}</span>
    <ChevronRight size={15} />
  </button>
}
