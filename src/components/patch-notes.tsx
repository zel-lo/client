import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, FileText, Plus, RefreshCw } from 'lucide-react'
import { useWorkspaceData } from '../hooks/use-workspace-data'
import { saveNote, changed, collectWorkChanges, saveChangeTitle } from '../lib/workspace-api'
import type { Note, Page, WorkChange } from '../lib/workspace-api'
import type { Project } from '../lib/project-api'
import { LoadingState } from './loading-state'
import { MarkdownView } from './markdown'
import { ChangeNewsList } from './change-news-list'
import type { ChangeNewsItem } from './change-news-list'
import './patch-notes.css'
export function Notes({ project }: { project: Project }) {
  const [page, setPage] = useState(1), [editing, setEditing] = useState<Note | 'new' | null>(null), [title, setTitle] = useState(''), [body, setBody] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const result = useWorkspaceData<Page<Note>>(project.id, `patch-notes?page=${page}`)
  const [params] = useSearchParams()
  const noteId = params.get('note')
  const selected = useWorkspaceData<Note>(noteId ? project.id : '', `patch-notes/${encodeURIComponent(noteId ?? '')}`)
  const canWrite = project.role !== 'VIEWER'
  function titleSaved(note: Note) { setEditing(current => current && current !== 'new' && current.id === note.id ? { ...current, version: note.version, changes: note.changes } : current) }
  async function collect() { setBusy(true); setError(''); try { await collectWorkChanges(project.id); setPage(1); changed() } catch(e) { setError((e as Error).message) } finally { setBusy(false) } }
  function edit(note: Note | 'new') { setEditing(note); setTitle(note === 'new' ? '' : note.title); setBody(note === 'new' ? '' : note.summary); setError('') }
  async function save(publish: boolean) { setBusy(true); setError(''); try { await saveNote(project.id, { title, summary: body, publish, version: editing && editing !== 'new' ? editing.version : undefined }, editing && editing !== 'new' ? editing.id : undefined); setEditing(null); changed() } catch(e) { setError((e as Error).message) } finally { setBusy(false) } }
  const notes = noteId ? selected.data ? [selected.data] : [] : result.data?.items ?? []
  const entries = noteId ? [] : newsItems(notes, project.id, canWrite, titleSaved)
  const loading = noteId ? selected.loading : result.loading
  const failure = error || (noteId ? selected.error : result.error)
  return <section className="release-notes" aria-label="패치노트">
    <header className="release-toolbar"><div><h2>변경 소식</h2><p>새로 반영한 내용을 하나씩 확인해 보세요.</p></div>{canWrite && <div className="release-actions"><button className="button" disabled={busy} onClick={() => void collect()}><RefreshCw size={14} />완료 기록 모으기</button><button className="button button-dark" disabled={busy} onClick={() => edit('new')}><Plus size={14} />패치노트 작성</button></div>}</header>
    {noteId && <Link className="release-back" to="/changes"><ArrowLeft size={14} />전체 패치노트 보기</Link>}
    {failure && <div role="alert" className="connection-error">{failure}<button className="button" onClick={() => { result.refresh(); selected.refresh() }}>다시 시도</button></div>}
    {editing && <form className="settings-form release-editor" onSubmit={e => { e.preventDefault(); void save(false) }}><h3>{editing === 'new' ? '새 패치노트' : '패치노트 편집'}</h3><label>제목<input required maxLength={255} value={title} disabled={busy} onChange={e => setTitle(e.target.value)} /></label><label>변경 내용<textarea required maxLength={20000} rows={8} value={body} disabled={busy} onChange={e => setBody(e.target.value)} /></label><div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => setEditing(null)}>취소</button><button className="button" disabled={busy || !title.trim() || !body.trim()}>저장</button><button type="button" className="button button-dark" disabled={busy || !title.trim() || !body.trim() || (editing !== 'new' && editing.status !== 'PUBLISHED' && !!editing.changes?.some(c => c.needsTitle && ['COMPLETED', 'MERGED'].includes(c.status)))} onClick={() => void save(true)}>팀에 공개</button></div></form>}
    {loading && !notes.length ? <LoadingState /> : <>
      {noteId ? notes.map(note => <ReleaseEntry key={note.id} note={note} project={project.id} canWrite={canWrite} busy={busy} onEdit={() => edit(note)} onSaved={titleSaved} />)
        : <ChangeNewsList items={entries} />}
      {!(noteId ? notes : entries).length && !failure && <div className="release-empty"><FileText size={28} /><h3>첫 번째 변화를 기다리고 있어요</h3><p>작업을 완료하거나 PR을 병합하면 이곳에 기록이 모여요.</p></div>}
    </>}

    {!noteId && result.data && (page > 1 || result.data.hasNext) && <nav className="connection-pagination" aria-label="패치노트 페이지"><button className="button" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>이전</button><span>{page} 페이지</span><button className="button" disabled={!result.data.hasNext || loading} onClick={() => setPage(value => value + 1)}>다음</button></nav>}
  </section>
}
function noteDate(note: Note) {
  const value = note.publishedAt ?? note.createdAt ?? note.changes?.map(change => change.occurredAt).sort().at(-1)
  if (!value) return null
  const date = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z')
  return Number.isNaN(date.getTime()) ? null : { value: date.toISOString(), year: date.getFullYear(), label: date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) }
}
function newsItems(notes: Note[], project: string, canWrite: boolean, onSaved: (note: Note) => void): ChangeNewsItem[] {
  return notes.flatMap<ChangeNewsItem>(note => {
    const changes = (note.changes ?? []).filter(change => change.status !== 'CONSOLIDATED' || note.status === 'PUBLISHED')
    if (changes.length) return changes.map(change => ({
      id: `${note.id}:${change.id}`, category: change.category, date: change.occurredAt, title: change.title,
      metadata: <><span className={change.needsTitle && note.status !== 'PUBLISHED' ? 'release-pending' : undefined}>{change.needsTitle && note.status !== 'PUBLISHED' ? '반영 사항 작성 필요' : note.status === 'PUBLISHED' ? '공개됨' : '작성 중'}</span>
        {change.status === 'REOPENED' && <span>다시 진행 중</span>}{change.status === 'ARCHIVED' && <span>보관됨</span>}
        <Link to={`/changes?note=${encodeURIComponent(note.id)}`}>패치노트 보기<ArrowUpRight size={12} /></Link>
        {(change.issueId || change.pullRequestId) && <Link to={change.issueId ? `/issues?issue=${change.issueId}` : `/pull-requests?pr=${change.pullRequestId}`}>{change.issueId ? '관련 작업' : '관련 PR'}<ArrowUpRight size={12} /></Link>}
        {canWrite && note.status === 'DRAFT' && ['COMPLETED', 'MERGED'].includes(change.status) && <ChangeTitleEditor project={project} note={note} change={change} onSaved={onSaved} />}
      </>,
    }))
    // A manually authored update is a single piece of news. Empty automatic drafts stay out of the feed.
    if (note.automatic) return []
    return [{ id: note.id, category: 'TEAM', date: note.publishedAt ?? note.createdAt, title: note.title,
      metadata: <><span>{note.status === 'PUBLISHED' ? '공개됨' : '작성 중'}</span><Link to={`/changes?note=${encodeURIComponent(note.id)}`}>패치노트 보기<ArrowUpRight size={12} /></Link></> }]
  })
}
function ReleaseEntry({ note, project, canWrite, busy, onEdit, onSaved }: { note: Note; project: string; canWrite: boolean; busy: boolean; onEdit: () => void; onSaved: (note: Note) => void }) {
  const date = noteDate(note)
  const count = (note.changes ?? []).filter(change => change.status !== 'CONSOLIDATED' || note.status === 'PUBLISHED').length
  return <article className="release-detail" id={`note-${note.id}`}>

    <div className="release-date">{date ? <><span>{date.year}</span><time dateTime={date.value}>{date.label}</time></> : <span>날짜 미정</span>}<span className={`release-status ${note.status === 'PUBLISHED' ? 'is-published' : ''}`}>{note.status === 'PUBLISHED' ? '공개됨' : '작성 중'}</span></div>
    <div className="release-content"><div className="release-heading"><div><div className="release-eyebrow">{note.automatic ? '주간 업데이트' : '팀 업데이트'}{count > 0 && <span> · {count}개의 변경</span>}</div><h3>{note.title}</h3></div>{canWrite && <button className="button release-edit" disabled={busy} onClick={onEdit}>내용 편집</button>}</div>
      {note.summary.trim() && <div className="release-intro"><MarkdownView source={note.summary} /></div>}
      <NoteChanges project={project} note={note} canWrite={canWrite} onSaved={onSaved} />
      <footer className="release-footer">{note.author && <span>{note.author}</span>}</footer>
    </div>
  </article>
}
function NoteChanges({ project, note, canWrite, onSaved }: { project: string; note: Note; canWrite: boolean; onSaved: (note: Note) => void }) {
  const categories = { FEATURE: '새 기능', IMPROVE: '개선 사항', FIX: '오류 수정' }
  const states = { COMPLETED: '작업 완료', MERGED: 'PR 병합', REOPENED: '다시 진행 중', ARCHIVED: '보관됨', CONSOLIDATED: '연결 작업으로 통합됨' }
  const changes = (note.changes ?? []).filter(c => c.status !== 'CONSOLIDATED' || note.status === 'PUBLISHED')
  if (!changes.length) return null
  const pending = note.status !== 'PUBLISHED' && changes.some(c => c.needsTitle && ['COMPLETED', 'MERGED'].includes(c.status))
  return <section className="release-changes" aria-label="패치노트에 모인 작업">
    {pending && <p className="release-pending-help">GitHub에서 가져온 변경 사항의 반영 제목을 작성하면 팀에 공개할 수 있어요.</p>}
    <ul className="release-change-list">{changes.map(change => <li className="release-change" key={change.id}>
      <div className="release-change-heading"><span className={`release-kind release-kind-${change.category.toLowerCase()}`}>{categories[change.category]}</span><h5>{change.title}</h5>{change.needsTitle && note.status !== 'PUBLISHED' && <span className="release-pending">반영 사항 작성 필요</span>}</div>
      <div className="release-change-meta"><time dateTime={change.occurredAt}>{noteDate({ ...note, publishedAt: change.occurredAt })?.label}</time><span>{states[change.status]}</span>{(change.issueId || change.pullRequestId) && <Link to={change.issueId ? `/issues?issue=${change.issueId}` : `/pull-requests?pr=${change.pullRequestId}`}>{change.issueId ? '관련 작업 보기' : '관련 PR 보기'}<ArrowUpRight size={12} /></Link>}
        {canWrite && note.status === 'DRAFT' && ['COMPLETED', 'MERGED'].includes(change.status) && <ChangeTitleEditor project={project} note={note} change={change} onSaved={onSaved} />}
      </div>
      {change.summary.trim() && <details className="release-source"><summary>상세 내용</summary><MarkdownView source={change.summary} /></details>}
    </li>)}</ul>
  </section>
}
function ChangeTitleEditor({ project, note, change, onSaved }: { project: string; note: Note; change: WorkChange; onSaved: (note: Note) => void }) {
  const [editing, setEditing] = useState(false), [title, setTitle] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save() {
    if (!title.trim() || busy) return
    setBusy(true); setError('')
    try { const saved = await saveChangeTitle(project, note.id, change.id, title.trim(), note.version); onSaved(saved); setEditing(false); changed() }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  if (!editing) return <button type="button" className="button" onClick={() => { setTitle(change.needsTitle ? '' : change.title); setEditing(true) }}>{change.needsTitle ? '반영 사항 작성' : '반영 제목 수정'}</button>
  return <form className="dialog-form note-change-editor" onSubmit={event => { event.preventDefault(); void save() }}>
    <label>패치노트 제목<input autoFocus required maxLength={255} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="팀에 소개할 반영 사항을 작성해 주세요" /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => setEditing(false)}>취소</button><button className="button button-dark" disabled={busy || !title.trim()}>{busy ? '저장 중…' : '반영 사항 저장'}</button></div>
  </form>
}
