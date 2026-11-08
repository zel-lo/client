import { useEffect, useState } from 'react'
import { Check, Copy, ExternalLink, GitBranch, Play } from 'lucide-react'
import { getIssueWorkBranch, startIssueWorkBranch } from '../lib/project-api'
import type { IssueWorkBranch, LiveIssue } from '../lib/project-api'

export function IssueWorkBranchPanel({ projectId, issue, canWrite, disabled, onBusyChange, onChanged }: {
  projectId: string; issue: LiveIssue; canWrite: boolean; disabled: boolean
  onBusyChange: (busy: boolean) => void; onChanged: (issue: LiveIssue) => void
}) {
  const [branch, setBranch] = useState<IssueWorkBranch | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const published = issue.publishStatus === 'PUBLISHED'
  useEffect(() => {
    setBranch(null); setError(''); setNotice(''); setCopied(false)
    if (!published) return
    const controller = new AbortController(); setLoading(true)
    getIssueWorkBranch(projectId, issue.id, controller.signal).then(result => {
      if (!controller.signal.aborted) setBranch(result)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '브랜치를 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [projectId, issue.id, published])

  async function start() {
    setBusy(true); onBusyChange(true); setError(''); setNotice(''); setCopied(false)
    try {
      const result = await startIssueWorkBranch(projectId, issue)
      setBranch(result); onChanged(result.issue)
      setNotice(result.created ? 'GitHub에 작업 브랜치를 만들었어요.' : '기존 작업 브랜치를 확인했어요. 이어서 작업할 수 있어요.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : '작업을 시작하지 못했어요.') }
    finally { setBusy(false); onBusyChange(false) }
  }
  async function copy() {
    if (!branch?.ready) return
    try { await navigator.clipboard.writeText(branch.commands); setCopied(true); setError('') }
    catch { setCopied(false); setError('자동 복사가 되지 않았어요. 아래 명령어를 선택해 복사해 주세요.') }
  }
  const completed = issue.status === 'DONE' || issue.githubState === 'CLOSED'
  return <section className="issue-work-branch" aria-label="작업 브랜치"><div className="work-branch-heading"><h3><GitBranch size={15} />작업 브랜치</h3>
    {canWrite && published && !issue.archived && !completed && <button type="button" className="button" disabled={disabled || busy || loading} onClick={() => void start()}><Play size={13} />{busy ? '브랜치 확인 중…' : branch?.ready ? '작업 브랜치 확인' : '브랜치 만들기'}</button>}
  </div>
    {!published && <p className="help-text">GitHub에 이슈를 발행하면 이슈 번호로 작업 브랜치를 만들 수 있어요.</p>}
    {loading && <p className="help-text" role="status">작업 브랜치를 불러오는 중…</p>}
    {branch && <p className="help-text"><strong>{branch.repository}</strong> · <code>{branch.name}</code>{!branch.ready && <> · <code>{branch.baseBranch}</code>에서 시작</>}</p>}
    {branch && !branch.ready && canWrite && !completed && !issue.archived && <p className="help-text">브랜치 만들기를 누르면 GitHub에 실제 브랜치를 만들어요. 같은 이름이 있으면 기존 브랜치를 사용해요.</p>}
    {branch?.ready && <><div className="work-branch-links"><a className="subtle-link" href={branch.url} target="_blank" rel="noopener noreferrer">GitHub에서 브랜치 보기<ExternalLink size={12} /></a><button type="button" className="button" onClick={() => void copy()}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '복사했어요' : 'Git 명령어 복사'}</button></div>
      <p className="help-text">이 저장소가 있는 로컬 폴더의 터미널에서 실행해 주세요. 새 브랜치와 기존 로컬 브랜치 모두 전환할 수 있어요.</p>
      <pre className="work-branch-commands" aria-label="작업 브랜치 전환 명령어"><code>{branch.commands}</code></pre></>}
    {notice && <p className="connection-notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section>
}
