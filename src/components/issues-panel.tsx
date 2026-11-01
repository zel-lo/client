import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Circle, CircleDashed, CircleDot, Clock3, Flag, GitPullRequest, Plus, UserRound } from 'lucide-react'
import type { FormEvent } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { startOfWeek } from '../lib/work-weeks'
import { members } from '@/data/mock'
import type { Repo } from '@/data/mock'
import { CURRENT_USER, issuePriorities, issueStatuses, issueSources, repositoryRef } from '@/data/work-items'
import type { Issue, IssueSource, IssueStatus, PullRequest } from '@/data/work-items'

export const issueStatusIcons = { backlog: CircleDashed, todo: Circle, in_progress: CircleDot, in_review: Clock3, done: CheckCircle2 }

export function IssuesPanel({ issues, repos, pullRequests, repoFilter, onSelect, onCreate, onSelectPr, onCreatePr }: {
  issues: Issue[]; repos: Repo[]; pullRequests: PullRequest[]; repoFilter: string;
  onSelect: (issue: Issue) => void; onCreate: () => void; onSelectPr: (pr: PullRequest) => void; onCreatePr: (issue: Issue) => void;
}) {
  const [params, setParams] = useSearchParams()
  const filter = params.get('status') ?? 'active'
  const focus = params.get('focus') ?? 'all'
  const assignee = params.get('assignee') ?? 'all'
  const source = params.get('source') ?? 'all'
  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if ((value === 'all' && key !== 'status') || (key === 'status' && value === 'active')) next.delete(key)
    else next.set(key, value)
    setParams(next)
  }
  const scoped = issues.filter(issue => (repoFilter === 'all' || issue.repo === repoFilter)
    && (source === 'all' || issue.source === source)
    && (assignee === 'all' || issue.assignee === assignee)
    && (focus === 'all' || (focus === 'mine' ? issue.assignee === CURRENT_USER : focus === 'unassigned' ? !issue.assignee : focus === 'unlinked' ? !pullRequests.some(pr => issue.pullRequestIds.includes(pr.id)) : true)))
  const visible = scoped.filter(issue => filter === 'all' || (filter === 'done' ? issue.status === 'done' : issue.status !== 'done'))
  return <section className="work-panel" aria-label="이슈 목록">
    <div className="content-filter"><div className="segmented-tabs">{[['active', '진행할 작업'], ['done', '완료'], ['all', '전체']].map(([value, label]) => <button key={value} className={filter === value ? 'selected' : ''} aria-pressed={filter === value} onClick={() => setFilter('status', value)}>{label}<span className="tab-count">{scoped.filter(issue => value === 'all' || (value === 'done' ? issue.status === 'done' : issue.status !== 'done')).length}</span></button>)}</div><span className="muted small">{visible.length}개의 이슈 · 모든 저장소를 한곳에서</span></div>
    <div className="work-filter-bar"><select aria-label="작업 확인 필터" value={focus} onChange={event => setFilter('focus', event.target.value)}><option value="all">전체 작업</option><option value="mine">내가 맡은 작업</option><option value="unassigned">담당자 미지정</option><option value="unlinked">PR 미연결</option></select><select aria-label="담당자 필터" value={assignee} onChange={event => setFilter('assignee', event.target.value)}><option value="all">모든 담당자</option>{members.map(member => <option key={member.name}>{member.name}</option>)}</select><select aria-label="회의 구분 필터" value={source} onChange={event => setFilter('source', event.target.value)}><option value="all">모든 등록 경로</option>{Object.entries(issueSources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{params.size > 0 && <button className="subtle-link" onClick={() => setParams({})}>필터 초기화</button>}</div>
    <div className="data-frame"><Table><TableHeader><TableRow><TableHead>할 일 / 등록 경로</TableHead><TableHead>상태</TableHead><TableHead>우선순위</TableHead><TableHead>담당자</TableHead><TableHead>이슈 → PR</TableHead></TableRow></TableHeader><TableBody>
      {visible.map(issue => { const Icon = issueStatusIcons[issue.status]; const linked = pullRequests.filter(pr => issue.pullRequestIds.includes(pr.id)); return <TableRow key={issue.id}>
        <TableCell><button className="issue-title" onClick={() => onSelect(issue)}><span className="issue-id mono">{issue.id}</span><span>{issue.title}<small>{repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)} · {issueSources[issue.source ?? 'request']}{issue.meetingDate ? ` · ${issue.meetingDate.slice(5).replace('-', '/')}` : ''}</small></span></button></TableCell>
        <TableCell><span className={`issue-status-badge issue-status-${issue.status}`}><Icon size={12} />{issueStatuses[issue.status]}</span></TableCell>
        <TableCell><span className={`priority-cell priority-${issue.priority}`}><Flag size={12} />{issuePriorities[issue.priority]}</span></TableCell>
        <TableCell><span className={`issue-assignee ${!issue.assignee ? 'unassigned-label' : ''}`}><UserRound size={12} />{issue.assignee || '지정 필요'}</span></TableCell>
        <TableCell><div className="issue-linked-actions">{linked.map(pr => <button key={pr.id} className="reference-link" onClick={() => onSelectPr(pr)}><GitPullRequest size={12} />{repositoryRef(pr.repo, pr.number, repos)}</button>)}{!linked.length && issue.status !== 'done' && <button className="reference-link" onClick={() => onCreatePr(issue)}><Plus size={12} />PR 작성</button>}{!linked.length && issue.status === 'done' && <span className="muted">—</span>}</div></TableCell>
      </TableRow> })}
    </TableBody></Table></div>
    {!visible.length && <div className="empty-state"><CircleDot size={25} /><h3>표시할 이슈가 없어요</h3><p>필터를 바꾸거나 회의에서 정한 작업을 새로 등록해 보세요.</p><button className="button" onClick={onCreate}><Plus size={13} />이슈 만들기</button></div>}
    <p className="work-demo-note">이슈·PR 번호는 저장소별 샘플입니다. 회의 기록과 편집 내용은 이 브라우저에 저장되며 실제 GitHub에는 전송하지 않습니다.</p>
  </section>
}

export function IssueEditor({ issue, repos, pullRequests, defaultRepo, onSave, onCancel, onViewPr }: {
  issue: Issue | null; repos: Repo[]; pullRequests: PullRequest[]; defaultRepo: string;
  onSave: (issue: Omit<Issue, 'id'>) => void; onCancel: () => void; onViewPr: (pr: PullRequest) => void;
}) {
  const [editorParams] = useSearchParams()
  const [form, setForm] = useState<Omit<Issue, 'id'>>(() => issue ?? {
    plannedWeekStart: startOfWeek(editorParams.get('week') ?? undefined), title: '', description: '', status: 'todo', priority: 'medium', assignee: '',
    repo: repos.some(repo => repo.id === defaultRepo) ? defaultRepo : repos[0]?.id ?? '', pullRequestIds: [], source: 'daily', meetingDate: '2026-10-27', acceptanceCriteria: '',
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.title.trim() || !repos.some(repo => repo.id === form.repo)) return
    onSave({ ...form, title: form.title.trim(), description: form.description.trim(), acceptanceCriteria: form.acceptanceCriteria?.trim(), meetingDate: ['daily', 'weekly'].includes(form.source ?? '') ? form.meetingDate : undefined })
  }
  return <form className="dialog-form issue-editor" onSubmit={submit}>
    <span className="eyebrow">{issue ? `${issue.id} · ${repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)}` : 'MEETING → ISSUE'}</span><h2>{issue ? '이슈 상세' : '어떤 작업을 할까요?'}</h2>
    <label>이슈 제목<input autoFocus required maxLength={180} placeholder="해야 할 작업을 한 문장으로 적어주세요" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label>
    <label>설명<textarea rows={4} maxLength={5000} placeholder="해결할 문제와 기대하는 결과를 적어주세요" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
    <label>완료 조건<textarea rows={2} maxLength={2000} placeholder="무엇을 확인하면 이 작업이 끝났다고 할 수 있나요?" value={form.acceptanceCriteria ?? ''} onChange={event => setForm({ ...form, acceptanceCriteria: event.target.value })} /></label>
    <div className="issue-fields"><label>작업이 나온 곳<select value={form.source ?? 'request'} onChange={event => setForm({ ...form, source: event.target.value as IssueSource })}>{Object.entries(issueSources).filter(([value]) => value !== 'github' || form.source === 'github').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{['daily', 'weekly'].includes(form.source ?? '') && <label>회의 날짜<input type="date" required value={form.meetingDate ?? '2026-10-27'} onChange={event => setForm({ ...form, meetingDate: event.target.value })} /></label>}<label>상태<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as IssueStatus })}>{Object.entries(issueStatuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>우선순위<select value={form.priority} onChange={event => setForm({ ...form, priority: event.target.value as Issue['priority'] })}>{Object.entries(issuePriorities).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>계획 주차<input type="date" value={form.plannedWeekStart ?? startOfWeek(form.meetingDate)} onChange={event => { if (event.target.value) setForm({ ...form, plannedWeekStart: startOfWeek(event.target.value) }) }} /></label>
    <label>담당자<select value={form.assignee} onChange={event => setForm({ ...form, assignee: event.target.value })}><option value="">미지정</option>{members.map(member => <option key={member.name}>{member.name}</option>)}</select></label>
    <label>연결 저장소<select value={form.repo} onChange={event => setForm({ ...form, repo: event.target.value, pullRequestIds: [] })}>{repos.map(repo => <option key={repo.id} value={repo.id}>{repo.name}</option>)}</select></label></div>
    <fieldset className="issue-pr-links"><legend>이 이슈를 해결하는 PR</legend>{pullRequests.filter(pr => pr.repo === form.repo).map(pr => <div className="issue-pr-option" key={pr.id}><label><input type="checkbox" checked={form.pullRequestIds.includes(pr.id)} onChange={() => setForm({ ...form, pullRequestIds: form.pullRequestIds.includes(pr.id) ? form.pullRequestIds.filter(id => id !== pr.id) : [...form.pullRequestIds, pr.id] })} /><span><strong>#{pr.number} {pr.title}</strong><small>{pr.branch} · {pr.status === 'merged' ? '병합됨' : pr.status === 'draft' ? '초안' : '열림'}</small></span></label>{issue && issue.pullRequestIds.includes(pr.id) && <button type="button" className="subtle-link" onClick={() => onViewPr(pr)}>PR 보기</button>}</div>)}{!pullRequests.some(pr => pr.repo === form.repo) && <p className="help-text">이 저장소에는 연결할 샘플 PR이 없어요.</p>}</fieldset>
    <div className="form-actions"><span className="help-text">이 브라우저에만 저장 · GitHub 미연결</span><button type="button" className="button" onClick={onCancel}>취소</button><button type="submit" className="button button-dark" disabled={!form.title.trim() || !form.repo}>{issue ? '이슈 저장' : '이슈 만들기'}</button></div>
  </form>
}
