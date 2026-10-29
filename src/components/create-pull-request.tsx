import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, GitBranch } from 'lucide-react'
import { activities } from '@/data/mock'
import type { Repo } from '@/data/mock'
import { CURRENT_USER, repositoryRef } from '@/data/work-items'
import type { Issue, PullRequest } from '@/data/work-items'

export type PullRequestDraft = Omit<PullRequest, 'id' | 'number'> & { issueIds: string[] }
export function CreatePullRequest({ repos, issues, defaultRepo, defaultIssue, onSubmit, onCancel }: {
  repos: Repo[]; issues: Issue[]; defaultRepo: string; defaultIssue: Issue | null;
  onSubmit: (draft: PullRequestDraft) => void; onCancel: () => void;
}) {
  const initialRepo = defaultIssue?.repo ?? (repos.some(repo => repo.id === defaultRepo) ? defaultRepo : repos[0]?.id ?? '')
  const [repo, setRepo] = useState(initialRepo)
  const [title, setTitle] = useState(defaultIssue?.title ?? '')
  const [summary, setSummary] = useState('')
  const [branch, setBranch] = useState(defaultIssue ? `feat/${defaultIssue.id.toLowerCase()}` : '')
  const [base, setBase] = useState(repos.find(item => item.id === initialRepo)?.branch ?? 'main')
  const [issueIds, setIssueIds] = useState<string[]>(defaultIssue ? [defaultIssue.id] : [])
  const [isDraft, setIsDraft] = useState(false)
  const valid = Boolean(title.trim() && summary.trim() && branch.trim() && base.trim() && branch.trim() !== base.trim() && issueIds.length)
  const available = issues.filter(issue => issue.repo === repo && issue.status !== 'done')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || !repos.some(item => item.id === repo)) return
    const validIds = issueIds.filter(id => available.some(issue => issue.id === id))
    if (!validIds.length) return
    onSubmit({ title: title.trim(), summary: summary.trim(), repo, branch: branch.trim(), base: base.trim(), author: CURRENT_USER, status: isDraft ? 'draft' : 'open', review: 'pending', checks: 'running', issueIds: validIds })
  }
  return <form className="dialog-form" onSubmit={submit}><h2>이슈에서 코드 검토까지</h2><p>작업한 브랜치와 해결할 이슈를 연결하고, 팀이 이해할 수 있게 변경 내용을 적어주세요.</p>
    <label>PR 저장소<select className="form-select" value={repo} onChange={event => { setRepo(event.target.value); setIssueIds([]); setBranch(''); setBase(repos.find(item => item.id === event.target.value)?.branch ?? 'main') }}>{repos.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label>PR 제목<input autoFocus required maxLength={180} value={title} onChange={event => setTitle(event.target.value)} placeholder="어떤 작업을 마쳤나요?" /></label>
    <div className="issue-fields"><label>작업 브랜치<input required list="demo-pr-branches" value={branch} onChange={event => setBranch(event.target.value)} placeholder="feat/collection-share" /><datalist id="demo-pr-branches">{[...new Set(activities.filter(activity => activity.repo === repo).map(activity => activity.branch))].filter(name => name !== base && name !== '기획 중').map(name => <option key={name} value={name} />)}</datalist></label><label>대상 브랜치<input required value={base} onChange={event => setBase(event.target.value)} /></label></div>
    {branch.trim() && branch.trim() === base.trim() && <p className="form-error" role="alert">작업 브랜치와 대상 브랜치는 달라야 합니다.</p>}
    <label>팀을 위한 변경 요약<textarea required rows={3} maxLength={3000} value={summary} onChange={event => setSummary(event.target.value)} placeholder="무엇을 바꿨고, 사용자가 어떤 차이를 확인할 수 있나요?" /></label>
    <fieldset className="issue-pr-links"><legend>해결할 이슈 선택 · 필수</legend>{available.map(issue => <div className="issue-pr-option" key={issue.id}><label><input type="checkbox" checked={issueIds.includes(issue.id)} onChange={() => setIssueIds(current => current.includes(issue.id) ? current.filter(id => id !== issue.id) : [...current, issue.id])} /><span><strong>{issue.title}</strong><small>{repositoryRef(issue.repo, issue.githubNumber, repos, issue.id)} · {issue.assignee || '담당자 미지정'}</small></span></label></div>)}{!available.length && <p className="help-text">연결할 미완료 이슈가 없어요. 할 일에서 먼저 이슈를 등록해 주세요.</p>}</fieldset>
    <label className="inline-checkbox"><input type="checkbox" checked={isDraft} onChange={event => setIsDraft(event.target.checked)} />아직 작업 중이에요 · 초안으로 등록</label>
    <p className="help-text"><GitBranch size={12} />검토 요청은 연결된 이슈를 ‘검토 중’으로, 초안은 ‘진행 중’으로 표시합니다.</p>
    <div className="form-actions"><span className="help-text">브랜치·PR 생성은 데모이며 실제 GitHub에는 전송하지 않습니다.</span><button type="button" className="button" onClick={onCancel}>취소</button><button className="button button-dark" disabled={!valid} type="submit">{isDraft ? 'PR 초안 등록' : '코드 검토 요청'}<ArrowRight size={14} /></button></div>
  </form>
}
