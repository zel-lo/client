import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch } from 'lucide-react'
import { createPullRequest, listBranches, listConnectedRepositories, listReviewerCandidates, ProjectApiError } from '../lib/project-api'
import type { BranchList, ConnectedRepository, PullRequestItem, ReviewerCandidates } from '../lib/project-api'
import { MarkdownEditor } from './markdown'

const unknownOutcome = 'GITHUB_RESULT_UNKNOWN'

/** 프로젝트에 연결된 실제 저장소와 GitHub의 현재 브랜치로 PR을 만든다. */
export function CreateLivePullRequest({ projectId, onCreated, onCancel }: {
  projectId: string; onCreated: (pr: PullRequestItem) => void; onCancel: () => void;
}) {
  const [repos, setRepos] = useState<ConnectedRepository[] | null>(null)
  const [repoId, setRepoId] = useState('')
  const [branches, setBranches] = useState<BranchList | null>(null)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [head, setHead] = useState('')
  const [base, setBase] = useState('')
  const [title, setTitle] = useState('')
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
  const valid = Boolean(repoId && title.trim() && summary.trim() && head && base && head !== base)

  useEffect(() => {
    const controller = new AbortController()
    listConnectedRepositories(projectId, controller.signal).then(items => {
      setRepos(items); setRepoId(items[0]?.id ?? '')
    }).catch(cause => { if (!controller.signal.aborted) { setRepos([]); setError(cause instanceof Error ? cause.message : '저장소를 불러오지 못했어요.') } })
    return () => controller.abort()
  }, [projectId])

  useEffect(() => {
    if (!repoId) return
    const controller = new AbortController()
    setLoadingBranches(true); setBranches(null); setHead(''); setBase('')
    listBranches(projectId, repoId, controller.signal).then(list => {
      setBranches(list); setBase(list.defaultBranch)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '브랜치를 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingBranches(false) })
    return () => controller.abort()
  }, [projectId, repoId])

  // 리뷰어는 선택 항목이라, 후보를 못 불러와도 PR 작성은 막지 않는다.
  useEffect(() => {
    if (!repoId) return
    const controller = new AbortController()
    setCandidates(null); setReviewers([]); setCandidateError('')
    listReviewerCandidates(projectId, repoId, controller.signal).then(setCandidates)
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
        draft: isDraft, requestKey: requestKey.current, reviewers,
      }))
    } catch (cause) {
      if (!(cause instanceof ProjectApiError && cause.code === unknownOutcome)) requestKey.current = crypto.randomUUID()
      setError(cause instanceof Error ? cause.message : 'PR을 만들지 못했어요.')
    } finally { setBusy(false) }
  }

  const headOptions = (branches?.branches ?? []).filter(name => name !== base)
  return <form className="dialog-form" onSubmit={event => void submit(event)}><h2>코드 검토 요청하기</h2><p>작업한 브랜치를 골라 GitHub에 Pull request를 만들고, 팀이 이해할 수 있게 변경 내용을 적어주세요.</p>
    {repos && !repos.length && <p className="help-text">연결된 저장소가 없어요. <Link to="/settings?tab=repositories">프로젝트 설정</Link>에서 저장소를 먼저 연결해 주세요.</p>}
    <label>PR 저장소<select className="form-select" value={repoId} disabled={busy || !repos?.length} onChange={event => setRepoId(event.target.value)}>{repos?.map(item => <option key={item.id} value={item.id}>{item.owner}/{item.name}</option>)}</select></label>
    <label>PR 제목<input autoFocus required maxLength={180} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="어떤 작업을 마쳤나요?" /></label>
    <div className="issue-fields">
      <label>작업 브랜치<select className="form-select" required value={head} disabled={busy || loadingBranches || !branches} onChange={event => setHead(event.target.value)}><option value="">{loadingBranches ? '브랜치를 불러오는 중…' : '브랜치 선택'}</option>{headOptions.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      <label>대상 브랜치<select className="form-select" required value={base} disabled={busy || loadingBranches || !branches} onChange={event => { setBase(event.target.value); setHead(current => current === event.target.value ? '' : current) }}>{(branches?.branches ?? []).map(name => <option key={name} value={name}>{name}{name === branches?.defaultBranch ? ' (기본)' : ''}</option>)}</select></label>
    </div>
    {branches?.hasMore && <p className="help-text">브랜치가 많아 일부만 보여요. 목록에 없는 브랜치는 GitHub에서 직접 PR을 만들어 주세요.</p>}
    {branches && !headOptions.length && <p className="help-text">PR로 만들 수 있는 다른 브랜치가 없어요. 먼저 브랜치를 만들어 푸시해 주세요.</p>}
    <label>팀을 위한 변경 요약<textarea required rows={3} maxLength={3000} value={summary} disabled={busy} onChange={event => setSummary(event.target.value)} placeholder="무엇을 바꿨고, 사용자가 어떤 차이를 확인할 수 있나요?" /></label>
    <MarkdownEditor label="GitHub PR 본문" optional value={body} onChange={setBody} disabled={busy} maxLength={60000} placeholder="리뷰어가 볼 구현 내용, 테스트 방법 등을 적어주세요. GitHub에 그대로 올라가요." />
    <fieldset className="reviewer-options" disabled={busy}><legend>리뷰어 <span className="optional">선택</span></legend>
      {!candidates && !candidateError && repoId && <p className="help-text">리뷰어 후보를 불러오는 중…</p>}
      {candidateError && <p className="help-text">{candidateError}</p>}
      {candidates && !candidates.users.length && <p className="help-text">지정할 수 있는 사람이 없어요. 저장소에 협업자를 추가하면 여기에 나타나요.</p>}
      {candidates && candidates.users.length > 0 && <div>{candidates.users.map(user => <label key={user.login}><input type="checkbox" checked={reviewers.includes(user.login)} onChange={() => toggleReviewer(user.login)} />{user.login}</label>)}</div>}
      {candidates?.hasMore && <p className="help-text">사람이 많아 일부만 보여요.</p>}
    </fieldset>
    <label className="inline-checkbox"><input type="checkbox" checked={isDraft} disabled={busy} onChange={event => setIsDraft(event.target.checked)} />아직 작업 중이에요 · 초안으로 등록</label>
    <p className="help-text"><GitBranch size={12} />변경 요약은 zello에서만, GitHub PR 본문은 GitHub에 저장돼요. 해결할 이슈 연결은 이슈 기능이 준비되면 추가됩니다.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><span className="help-text">제출하면 GitHub에 실제 PR이 만들어져요.</span><button type="button" className="button" onClick={onCancel}>취소</button><button className="button button-dark" disabled={!valid || busy} type="submit">{busy ? '만드는 중…' : isDraft ? 'PR 초안 등록' : '코드 검토 요청'}<ArrowRight size={14} /></button></div>
  </form>
}
