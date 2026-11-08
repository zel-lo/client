import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch } from 'lucide-react'
import { createPullRequest, listBranches, listConnectedRepositories, listReviewerCandidates, ProjectApiError } from '../lib/project-api'
import type { BranchList, ConnectedRepository, PullRequestItem, ReviewerCandidates } from '../lib/project-api'
import { IssuePicker } from './issue-pr-links'
import type { LiveIssue } from '../lib/project-api'
import { MarkdownEditor } from './markdown'
import { ActionContext } from './workflow-help'

const unknownOutcome = 'GITHUB_RESULT_UNKNOWN'

/** 프로젝트에 연결된 실제 저장소와 GitHub의 현재 브랜치로 PR을 만든다. */
export function CreateLivePullRequest({ projectId, initialIssue, onCreated, onCancel }: {
  projectId: string; initialIssue?: LiveIssue | null; onCreated: (pr: PullRequestItem) => void; onCancel: () => void;
}) {
  const headHelpId = useId(), baseHelpId = useId()
  const [repos, setRepos] = useState<ConnectedRepository[] | null>(null)
  const [repoId, setRepoId] = useState(initialIssue?.repositoryId ?? '')
  const [issueIds, setIssueIds] = useState<string[]>(initialIssue ? [initialIssue.id] : [])
  const [branches, setBranches] = useState<BranchList | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [head, setHead] = useState('')
  const [base, setBase] = useState('')
  const [title, setTitle] = useState(initialIssue?.title ?? '')
  const [summary, setSummary] = useState('')
  const [body, setBody] = useState('')
  const [candidates, setCandidates] = useState<ReviewerCandidates | null>(null)
  const [candidateError, setCandidateError] = useState('')
  const [reviewers, setReviewers] = useState<string[]>([])
  const [isDraft, setIsDraft] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // 응답을 못 받은 요청을 다시 보낼 때만 같은 키를 쓴다. 그래야 GitHub에 PR이 두 번 만들어지지 않는다.
  const requestKey = useRef(crypto.randomUUID())
  const valid = Boolean(repoId && title.trim() && head && base && head !== base)

  useEffect(() => {
    const controller = new AbortController()
    listConnectedRepositories(projectId, controller.signal).then(items => {
      if (controller.signal.aborted) return
      setRepos(items); setRepoId(initialIssue?.repositoryId ?? items[0]?.id ?? '')
    }).catch(cause => { if (!controller.signal.aborted) { setRepos([]); setError(cause instanceof Error ? cause.message : '저장소를 불러오지 못했어요.') } })
    return () => controller.abort()
  }, [projectId, initialIssue?.repositoryId])

  useEffect(() => {
    if (!repoId) return
    const controller = new AbortController()
    setLoadingBranches(true); setBranches(null); setHead(''); setBase('')
    listBranches(projectId, repoId, controller.signal).then(list => {
      if (controller.signal.aborted) return
      setBranches(list); setBase(list.defaultBranch)
      if (initialIssue?.repositoryId === repoId && initialIssue.workBranch && initialIssue.workBranch !== list.defaultBranch && list.branches.includes(initialIssue.workBranch)) setHead(initialIssue.workBranch)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '브랜치를 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingBranches(false) })
    return () => controller.abort()
  }, [projectId, repoId, initialIssue?.workBranch])

  // 리뷰어는 선택 항목이라, 후보를 못 불러와도 검토 요청 만들기는 막지 않는다.
  useEffect(() => {
    if (!repoId) return
    const controller = new AbortController()
    setCandidates(null); setReviewers([]); setCandidateError('')
    listReviewerCandidates(projectId, repoId, controller.signal).then(value => { if (!controller.signal.aborted) setCandidates(value) })
      .catch(() => { if (!controller.signal.aborted) setCandidateError('리뷰어 후보를 불러오지 못했어요. 리뷰어 없이 만들 수 있어요.') })
    return () => controller.abort()
  }, [projectId, repoId])

  function toggleReviewer(login: string) {
    setReviewers(current => current.includes(login) ? current.filter(item => item !== login) : [...current, login])
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true); setError('')
    try {
      onCreated(await createPullRequest(projectId, {
        repositoryId: repoId, title: title.trim(), headBranch: head, baseBranch: base, teamSummary: summary.trim(), body: body.trim(),
        draft: isDraft, requestKey: requestKey.current, reviewers, issueIds,
      }))
    } catch (cause) {
      if (!(cause instanceof ProjectApiError && cause.code === unknownOutcome)) requestKey.current = crypto.randomUUID()
      setError(cause instanceof Error ? cause.message : 'PR을 만들지 못했어요.')
    } finally { setBusy(false) }
  }

  const headOptions = (branches?.branches ?? []).filter(name => name !== base)
  return <form className="dialog-form" onSubmit={event => void submit(event)}><ActionContext title="개발한 코드를 팀원에게 확인받아요" destination="github">코드 검토 요청(PR)을 만들면 GitHub에도 같은 요청이 생겨요. 변경한 내용과 검토받을 브랜치를 선택해 주세요.</ActionContext>
    {repos && !repos.length && <p className="help-text">연결된 저장소가 없어요. <Link to="/settings?tab=repositories">프로젝트 설정</Link>에서 저장소를 먼저 연결해 주세요.</p>}
    <label>코드가 있는 저장소<select className="form-select" value={repoId} disabled={busy || !repos?.length} onChange={event => { setRepoId(event.target.value); setIssueIds([]) }}>{repos?.map(item => <option key={item.id} value={item.id}>{item.owner}/{item.name}</option>)}</select></label>
    <label>검토 요청 제목<span className="field-required" aria-hidden="true">필수</span><input aria-label="검토 요청 제목" autoFocus required maxLength={180} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="예: 로그인 오류 안내 추가" /></label>
    <div className="issue-fields">
      <label>작업 브랜치<select aria-label="작업 브랜치" aria-describedby={headHelpId} className="form-select" required value={head} disabled={busy || loadingBranches || !branches} onChange={event => setHead(event.target.value)}><option value="">{loadingBranches ? '브랜치를 불러오는 중…' : '브랜치 선택'}</option>{headOptions.map(name => <option key={name} value={name}>{name}</option>)}</select><span id={headHelpId} className="field-help">검토받을 코드를 작업한 곳이에요.</span></label>
      <label>반영할 브랜치<select aria-label="반영할 브랜치" aria-describedby={baseHelpId} className="form-select" required value={base} disabled={busy || loadingBranches || !branches} onChange={event => { setBase(event.target.value); setHead(current => current === event.target.value ? '' : current) }}>{(branches?.branches ?? []).map(name => <option key={name} value={name}>{name}{name === branches?.defaultBranch ? ' (기본)' : ''}</option>)}</select><span id={baseHelpId} className="field-help">검토를 마친 코드를 합칠 곳이에요.</span></label>
    </div>
    {branches?.hasMore && <p className="help-text">브랜치가 많아 일부만 보여요. 목록에 없는 브랜치는 GitHub에서 직접 PR을 만들어 주세요.</p>}
    {branches && !headOptions.length && <p className="help-text">검토받을 작업 브랜치가 아직 없어요. 작업 상세에서 브랜치를 만들고, 코드를 GitHub에 올린 뒤 다시 시도해 주세요.</p>}
    {repoId && <IssuePicker projectId={projectId} repositoryId={repoId} selected={issueIds} disabled={busy} onChange={setIssueIds} />}
    <label>팀에 전할 변경 요약<span className="field-optional" aria-hidden="true">선택</span><textarea aria-label="팀에 전할 변경 요약" rows={3} maxLength={3000} value={summary} disabled={busy} onChange={event => setSummary(event.target.value)} placeholder="무엇이 바뀌었고 팀에 어떤 도움이 되나요? 예: 비밀번호가 틀렸을 때 다시 시도할 방법을 안내해요." /></label>
    <p className="help-text">변경 요약은 zello에서 팀이 함께 볼 설명이에요. 비워두면 GitHub 본문이나 제목을 사용해요.</p>
    <section className="form-section" aria-label="GitHub에 보낼 상세 설명"><h3>GitHub에 보낼 상세 설명</h3><MarkdownEditor label="GitHub PR 본문" optional value={body} onChange={setBody} disabled={busy} maxLength={60000} placeholder="구현 내용과 확인 방법을 적어 주세요. 이 내용은 GitHub에도 올라가요." /></section>
    <fieldset className="reviewer-options" disabled={busy}><legend>검토해 줄 팀원 <span className="optional">선택</span></legend>
      {!candidates && !candidateError && repoId && <p className="help-text">리뷰어 후보를 불러오는 중…</p>}
      {candidateError && <p className="help-text">{candidateError}</p>}
      {candidates && !candidates.users.length && <p className="help-text">지정할 수 있는 사람이 없어요. 저장소에 협업자를 추가하면 여기에 나타나요.</p>}
      {candidates && candidates.users.length > 0 && <div>{candidates.users.map(user => <label key={user.login}><input type="checkbox" checked={reviewers.includes(user.login)} onChange={() => toggleReviewer(user.login)} />{user.login}</label>)}</div>}
      {candidates?.hasMore && <p className="help-text">사람이 많아 일부만 보여요.</p>}
    </fieldset>
    <label className="inline-checkbox"><input type="checkbox" checked={isDraft} disabled={busy} onChange={event => setIsDraft(event.target.checked)} />아직 검토받기 전이에요 · 초안으로 만들기</label>
    <p className="help-text"><GitBranch size={12} />관련 작업을 연결하면 검토 상태를 함께 확인할 수 있어요. 코드가 기본 브랜치에 합쳐질 때 연결된 GitHub 이슈도 자동으로 완료될 수 있어요.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><span className="help-text">만들기 전 브랜치와 제목을 확인해 주세요.</span><button type="button" className="button" onClick={onCancel}>취소</button><button className="button button-dark" disabled={!valid || busy} type="submit">{busy ? '만드는 중…' : isDraft ? '검토 요청 초안 만들기' : '검토 요청 만들기'}<ArrowRight size={14} /></button></div>
  </form>
}
