import { useState } from 'react'
import { ExternalLink, GitMerge, RefreshCw } from 'lucide-react'
import { mergePullRequest, submitReview } from '../lib/project-api'
import type { PullRequestItem, ReviewEvent } from '../lib/project-api'
import { MarkdownEditor } from './markdown'

const reviewOptions: { value: ReviewEvent; label: string; help: string }[] = [
  { value: 'APPROVE', label: '승인', help: '병합해도 좋아요.' },
  { value: 'REQUEST_CHANGES', label: '수정 요청', help: '고친 뒤 다시 봐야 해요.' },
  { value: 'COMMENT', label: '코멘트', help: '승인·수정 요청 없이 의견만 남겨요.' },
]

/** GitHub mergeable_state별 안내. clean 외에는 zello에서 병합하지 않는다. */
const mergeReasons: Record<string, string> = {
  clean: '충돌 없이 병합할 수 있어요.',
  dirty: '대상 브랜치와 충돌이 있어요. GitHub에서 충돌을 해결해 주세요.',
  blocked: '필수 승인이나 검사 등 브랜치 보호 규칙을 아직 충족하지 않았어요.',
  behind: '대상 브랜치보다 뒤처져 있어요. GitHub에서 브랜치를 업데이트해 주세요.',
  unstable: '실패했거나 진행 중인 검사가 있어요.',
  draft: '초안 PR은 병합할 수 없어요. GitHub에서 리뷰 준비 완료로 바꿔 주세요.',
  unknown: 'GitHub가 병합 가능 여부를 확인하는 중이에요. 잠시 후 다시 확인해 주세요.',
}

export function mergeReason(mergeState: string | undefined, canMerge: boolean) {
  if (mergeState === 'clean' && !canMerge) return '조회 전용 멤버는 병합할 수 없어요.'
  return mergeReasons[mergeState ?? 'unknown'] ?? '지금은 zello에서 병합할 수 없어요.'
}

export function ReviewForm({ projectId, pullRequestId, onSubmitted }: {
  projectId: string; pullRequestId: string; onSubmitted: (item: PullRequestItem) => void;
}) {
  const [event, setEvent] = useState<ReviewEvent>('APPROVE')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const needsBody = event !== 'APPROVE'

  async function submit() {
    setSaving(true); setError(''); setDone('')
    try {
      const item = await submitReview(projectId, pullRequestId, event, body)
      setDone(`${reviewOptions.find(option => option.value === event)?.label} 리뷰를 GitHub에 남겼어요.`)
      setBody(''); setEvent('APPROVE')
      onSubmitted(item)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '리뷰를 제출하지 못했어요.')
    } finally { setSaving(false) }
  }

  return <section className="detail-summary pr-action" aria-label="리뷰 남기기">
    <span className="eyebrow">리뷰 남기기</span>
    <fieldset className="review-options" disabled={saving}><legend>리뷰 종류</legend>
      {reviewOptions.map(option => <label key={option.value} className={event === option.value ? 'selected' : undefined}>
        <input type="radio" name="review-event" value={option.value} checked={event === option.value} onChange={() => setEvent(option.value)} />
        <span><strong>{option.label}</strong><small>{option.help}</small></span>
      </label>)}
    </fieldset>
    <MarkdownEditor label="리뷰 의견" value={body} onChange={setBody} disabled={saving} maxLength={60000} optional={!needsBody}
      placeholder={needsBody ? '무엇을 고치면 좋을지, 어떤 점이 궁금한지 적어 주세요.' : '남길 의견이 있으면 적어 주세요.'} />
    <p className="help-text">줄 단위 코멘트는 GitHub 변경 파일 화면에서 남길 수 있어요.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {done && <p className="form-success" role="status">{done}</p>}
    <div className="form-actions"><button type="button" className="button button-dark" disabled={saving || (needsBody && !body.trim())} onClick={() => void submit()}>{saving ? '제출 중…' : '리뷰 제출'}</button></div>
  </section>
}

export function MergePanel({ projectId, detail, onMerged, onRecheck }: {
  projectId: string; detail: PullRequestItem; onMerged: (item: PullRequestItem) => void; onRecheck: () => void;
}) {
  const [confirming, setConfirming] = useState(false)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState('')
  const actions = detail.actions
  if (!actions) return null
  const ready = actions.canMerge && !!actions.headSha

  async function merge() {
    if (!actions?.headSha) return
    setMerging(true); setError('')
    try {
      onMerged(await mergePullRequest(projectId, detail.id, actions.headSha))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '병합하지 못했어요.')
      setConfirming(false)
    } finally { setMerging(false) }
  }

  return <section className="detail-summary pr-action" aria-label="병합">
    <span className="eyebrow">병합</span>
    <p className={`merge-state merge-${ready ? 'ready' : 'blocked'}`}>{mergeReason(actions.mergeState, actions.canMerge)}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {confirming
      ? <div className="merge-confirm"><p><code>{detail.headBranch}</code>을 <code>{detail.baseBranch}</code>에 merge commit으로 병합할까요? 브랜치는 삭제하지 않아요.</p>
        <div className="form-actions"><button type="button" className="button" disabled={merging} onClick={() => setConfirming(false)}>취소</button><button type="button" className="button button-dark" disabled={merging} onClick={() => void merge()}>{merging ? '병합 중…' : '병합 확인'}</button></div></div>
      : <div className="form-actions">
        {!ready && actions.mergeState === 'unknown' && <button type="button" className="button" onClick={onRecheck}><RefreshCw size={13} />다시 확인</button>}
        {!ready && <a className="button" href={detail.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} />GitHub에서 확인</a>}
        <button type="button" className="button button-dark" disabled={!ready} onClick={() => { setError(''); setConfirming(true) }}><GitMerge size={13} />병합하기</button>
      </div>}
  </section>
}
