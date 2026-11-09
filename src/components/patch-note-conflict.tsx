import { useId, useState } from 'react'
import type { Note, WorkChange } from '../lib/workspace-api'
import { MarkdownView } from './markdown'

type Draft = { title: string; summary: string; changes: WorkChange[] }
type Choice = 'mine' | 'latest'

/** Apply local additions/removals to the latest links, retaining teammates' additions. */
function mergeChanges(base: WorkChange[], mine: WorkChange[], latest: WorkChange[]) {
  const baseIds = new Set(base.map(change => change.id))
  const mineIds = new Set(mine.map(change => change.id))
  const merged = latest.filter(change => !baseIds.has(change.id) || mineIds.has(change.id))
  const mergedIds = new Set(merged.map(change => change.id))
  return [...merged, ...mine.filter(change => !baseIds.has(change.id) && !mergedIds.has(change.id))]
}

export function NoteConflict({ base, mine, latest, onResolve }: { base: Note; mine: Draft; latest: Note; onResolve: (draft: Draft) => void }) {
  const [choices, setChoices] = useState<Partial<Record<'title' | 'summary', Choice>>>({})
  const group = useId()
  const fields = ['title', 'summary'] as const
  const conflicts = fields.filter(field => mine[field] !== base[field] && latest[field] !== base[field] && mine[field] !== latest[field])
  const published = latest.status === 'PUBLISHED'
  function resolve() {
    if (conflicts.some(field => !choices[field])) return
    function merged(field: 'title' | 'summary') {
      if (conflicts.includes(field)) return choices[field] === 'mine' ? mine[field] : latest[field]
      return mine[field] === base[field] ? latest[field] : mine[field]
    }
    onResolve({ title: merged('title'), summary: merged('summary'), changes: published || latest.automatic ? latest.changes ?? [] : mergeChanges(base.changes ?? [], mine.changes, latest.changes ?? []) })
  }
  return <section className="release-conflict" aria-label="최신 변경 내용 확인">
    <h4>다른 팀원이 수정한 내용이 있어요</h4>
    <p>작성 중인 내용은 유지했어요. 같은 부분을 서로 다르게 수정했다면 사용할 내용을 선택해 주세요. 서로 다른 부분의 수정은 함께 반영해요.</p>
    {published && <p>다른 팀원이 이미 공개한 글이에요. 연결은 공개된 상태로 유지하고 제목과 본문을 이어서 편집할 수 있어요.</p>}
    <details open><summary>최신 저장 내용</summary><strong>{latest.title}</strong><MarkdownView source={latest.summary} />{!!latest.changes?.length && <ul>{latest.changes.map(change => <li key={change.id}>{change.title}</li>)}</ul>}</details>
    {conflicts.map(field => <fieldset key={field}>
      <legend>{field === 'title' ? '업데이트 제목 선택' : '변경 내용 선택'}</legend>
      {(['mine', 'latest'] as const).map(choice => <div key={choice}>
        <label><input type="radio" name={`${group}-${field}`} checked={choices[field] === choice} onChange={() => setChoices(current => ({ ...current, [field]: choice }))} />{choice === 'mine' ? '내가 작성한 내용' : '최신 저장 내용'}</label>
        {field === 'title' ? <p>{choice === 'mine' ? mine.title : latest.title}</p> : <MarkdownView source={choice === 'mine' ? mine.summary : latest.summary} />}
      </div>)}
    </fieldset>)}
    <button type="button" className="button" disabled={conflicts.some(field => !choices[field])} onClick={resolve}>{conflicts.length ? '선택한 내용으로 편집 계속' : '최신 변경과 합쳐 편집 계속'}</button>
  </section>
}
