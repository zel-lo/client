import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { members } from '../data/mock'
import type { Repo } from '../data/mock'
import { CURRENT_USER, issueSources } from '../data/work-items'
import type { Issue, PullRequest } from '../data/work-items'
import { belongsToWeek, startOfWeek, validWeek } from '../lib/work-weeks'
import { IssuesPanel } from './issues-panel'
import { TeamBoard, WeekNavigation, WorkViewToggle } from './team-board'
import type { BoardActions, BoardItem } from './team-board'
import { useWorkWeek } from '../hooks/use-work-week'

export function DemoTeamWork({ issues, repos, pullRequests, repoFilter, onSelect, onCreate, onSelectPr, onCreatePr, onUpdate }: {
  issues: Issue[]; repos: Repo[]; pullRequests: PullRequest[]; repoFilter: string;
  onSelect: (issue: Issue) => void; onCreate: () => void; onSelectPr: (pr: PullRequest) => void; onCreatePr: (issue: Issue) => void; onUpdate: (issues: Issue[]) => void;
}) {
  const [params, setParams] = useSearchParams()
  const currentWeek = useWorkWeek()
  const week = params.has('week') ? validWeek(params.get('week')) : currentWeek
  const view = params.get('view') === 'list' ? 'list' : 'board'
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const assignee = params.get('assignee') ?? 'all'
  const source = params.get('source') ?? 'all'
  const focus = params.get('focus') ?? 'all'
  const normalized = issues.map(issue => ({ ...issue, plannedWeekStart: issue.plannedWeekStart ?? startOfWeek(issue.meetingDate), completedAt: issue.completedAt ?? (issue.status === 'done' ? '2026-10-27T09:00:00Z' : null) }))
  const weekly = normalized.filter(issue => belongsToWeek(issue, week))
  function setParam(key: string, value: string) {
    setParams(current => { const next = new URLSearchParams(current); if (value === 'all' || key === 'week' && value === currentWeek) next.delete(key); else next.set(key, value); return next })
  }
  const loadPeople = useCallback(async (_repositoryId: string, _page: number, _signal: AbortSignal) => ({ items: members.map(member => ({ login: member.name })), hasNext: false }), [])
  const items: BoardItem[] = weekly.filter(issue => (repoFilter === 'all' || issue.repo === repoFilter) && (assignee === 'all' || issue.assignee === assignee) && (source === 'all' || issue.source === source) && (focus === 'all' || (focus === 'mine' ? issue.assignee === CURRENT_USER : focus === 'unassigned' ? !issue.assignee : focus === 'unlinked' ? !issue.pullRequestIds.length : true)) && `${issue.id} ${issue.title}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(issue => {
    const linked = pullRequests.filter(pr => issue.pullRequestIds.includes(pr.id))
    const failing = linked.some(pr => pr.status === 'open' && pr.checks === 'failing')
    const changes = linked.some(pr => pr.status === 'open' && pr.review === 'changes_requested')
    return { id: issue.id, key: issue.id, title: issue.title, status: issue.status, priority: issue.priority, repositoryId: issue.repo, repositoryName: repos.find(repo => repo.id === issue.repo)?.name ?? issue.repo, number: issue.githubNumber, assignee: issue.assignee || null, sourceLabel: issueSources[issue.source ?? 'request'], meetingDate: issue.meetingDate, plannedWeekStart: issue.plannedWeekStart, completedAt: issue.completedAt,
      references: linked.map(pr => ({ id: pr.id, label: `${repos.find(repo => repo.id === pr.repo)?.name ?? pr.repo}#${pr.number}` })),
      attention: issue.status === 'done' ? undefined : failing ? { label: '자동 검사 실패 · 수정이 필요해요', tone: 'danger' } : changes ? { label: '수정 요청을 확인해 주세요', tone: 'warning' } : !issue.assignee ? { label: '함께할 담당자를 지정해 주세요', tone: 'warning' } : linked.some(pr => pr.status === 'open' && pr.reviewers?.includes(CURRENT_USER) && pr.review === 'pending') ? { label: '내 리뷰를 기다리고 있어요', tone: 'info' } : undefined,
    }
  })
  const actions: BoardActions = {
    onOpen: id => { const issue = issues.find(item => item.id === id); if (issue) onSelect(issue) },
    onMove: ({ id, status, beforeId }) => {
      const moving = normalized.find(issue => issue.id === id)
      if (!moving) return
      const rows = normalized.filter(issue => issue.id !== id)
      const target = beforeId ? rows.findIndex(issue => issue.id === beforeId) : -1
      rows.splice(target < 0 ? rows.length : target, 0, { ...moving, status, plannedWeekStart: moving.status === 'backlog' && status !== 'backlog' ? week : moving.plannedWeekStart, completedAt: status === 'done' ? moving.completedAt ?? new Date().toISOString() : null })
      onUpdate(rows)
      setNotice(`${id} 작업 위치를 저장했어요.`)
    },
    onAssign: (id, login) => { onUpdate(normalized.map(issue => issue.id === id ? { ...issue, assignee: login ?? '' } : issue)); setNotice(`${id} 담당자를 저장했어요.`) },
    loadAssignees: loadPeople,
    onReference: id => { const pr = pullRequests.find(pr => pr.id === id); if (pr) onSelectPr(pr) },
  }
  return <section className="demo-team-work" aria-label="주간 팀 작업">
    <WeekNavigation week={week} onChange={value => setParam('week', value)} />
    <div className="board-toolbar"><WorkViewToggle view={view} onChange={value => setParam('view', value)} />
      {view === 'board' && <><input className="board-search" type="search" aria-label="작업 검색" placeholder="제목 또는 작업 번호 검색" value={query} onChange={event => setQuery(event.target.value)} /><select aria-label="작업 확인 필터" value={focus} onChange={event => setParam('focus', event.target.value)}><option value="all">전체 작업</option><option value="mine">내가 맡은 작업</option><option value="unassigned">담당자 미지정</option><option value="unlinked">PR 미연결</option></select><select aria-label="담당자 필터" value={assignee} onChange={event => setParam('assignee', event.target.value)}><option value="all">모든 담당자</option>{members.map(member => <option key={member.name}>{member.name}</option>)}</select><select aria-label="회의 구분 필터" value={source} onChange={event => setParam('source', event.target.value)}><option value="all">모든 등록 경로</option>{Object.entries(issueSources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></>}
    </div>
    {notice && <p className="connection-notice" role="status"><CheckCircle2 size={13} /> {notice}</p>}
    {view === 'board' ? <>{!items.length && <div className="empty-state"><h3>표시할 이슈가 없어요</h3><p>필터를 바꾸거나 이번 주에 할 일을 등록해 보세요.</p><button className="button" onClick={() => { setQuery(''); setParams(current => { const next = new URLSearchParams(current); for (const key of ['focus', 'assignee', 'source']) next.delete(key); return next }) }}>필터 초기화</button></div>}<TeamBoard items={items} week={week} actions={actions} onCreate={onCreate} /><p className="work-demo-note">샘플 프로젝트예요. 변경 사항은 이 브라우저에 저장되며 실제 GitHub에는 전송하지 않아요.</p></> : <IssuesPanel issues={weekly} repos={repos} pullRequests={pullRequests} repoFilter={repoFilter} onSelect={onSelect} onCreate={onCreate} onSelectPr={onSelectPr} onCreatePr={onCreatePr} />}
  </section>
}
