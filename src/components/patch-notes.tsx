import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Plus, RefreshCw } from 'lucide-react'
import { useWorkspaceData } from '../hooks/use-workspace-data'
import { saveNote, changed, collectWorkChanges, saveChangeTitle } from '../lib/workspace-api'
import type { Note, Page, WorkChange } from '../lib/workspace-api'
import type { Project } from '../lib/project-api'
import { LoadingState } from './loading-state'
import { MarkdownEditor, MarkdownView } from './markdown'
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
  // 자동으로 만들어졌지만 아직 변경이 없는 초안은 목록에서 뺀다
  const entries = noteId ? [] : notes.filter(note => !note.automatic || visibleChanges(note).length > 0)
  const loading = noteId ? selected.loading : result.loading
  const publishBlocked = !!editing && editing !== 'new' && editing.status !== 'PUBLISHED' && !!editing.changes?.some(c => c.needsTitle && ['COMPLETED', 'MERGED'].includes(c.status))
  const failure = error || (noteId ? selected.error : result.error)
  return <section className="release-notes" aria-label="패치노트">
    {!noteId && <header className="release-toolbar"><span />{canWrite && <div className="release-actions"><button className="button" disabled={busy} onClick={() => void collect()}><RefreshCw size={14} />완료 기록 모으기</button><button className="button button-dark" disabled={busy} onClick={() => edit('new')}><Plus size={14} />패치노트 작성</button></div>}</header>}
    {noteId && <Link className="release-back" to="/changes"><ArrowLeft size={14} />전체 패치노트 보기</Link>}
    {failure && <div role="alert" className="connection-error">{failure}<button className="button" onClick={() => { result.refresh(); selected.refresh() }}>다시 시도</button></div>}
    {editing && <form className="dialog-form release-editor" aria-label={editing === 'new' ? '새 패치노트' : '패치노트 편집'} onSubmit={e => { e.preventDefault(); void save(false) }}>
      <div className="release-editor-head"><h3>{editing === 'new' ? '새 패치노트' : '패치노트 편집'}</h3><p>저장하면 초안으로 남고, 팀에 공개하면 변경 소식에서 모두가 볼 수 있어요.</p></div>
      <label>제목<input required maxLength={255} value={title} disabled={busy} placeholder="예: 11월 2주차 업데이트" onChange={e => setTitle(e.target.value)} /></label>
      <MarkdownEditor label="변경 내용" value={body} onChange={setBody} disabled={busy} maxLength={20000} placeholder="이번에 바뀐 점과 팀이 알아두면 좋을 내용을 적어 주세요." />
      <div className="form-actions">{publishBlocked && <span className="help-text">제목이 비어 있는 항목을 먼저 채워야 공개할 수 있어요.</span>}<button type="button" className="button" disabled={busy} onClick={() => setEditing(null)}>취소</button><button className="button" disabled={busy || !title.trim() || !body.trim()}>저장</button><button type="button" className="button button-dark" disabled={busy || !title.trim() || !body.trim() || publishBlocked} onClick={() => void save(true)}>팀에 공개</button></div>
    </form>}
    {loading && !notes.length ? <LoadingState /> : <>
      {noteId ? notes.map(note => <ReleaseEntry key={note.id} note={note} project={project.id} canWrite={canWrite} busy={busy} onEdit={() => edit(note)} onSaved={titleSaved} />)
        : <div className="release-card-list">{entries.map(note => <NoteCard key={note.id} note={note} />)}</div>}
      {!(noteId ? notes : entries).length && !failure && <div className="release-empty"><FileText size={28} /><h3>첫 번째 변화를 기다리고 있어요</h3><p>작업을 완료하거나 PR을 병합하면 이곳에 기록이 모여요.</p></div>}
    </>}

    {!noteId && result.data && (page > 1 || result.data.hasNext) && <nav className="connection-pagination" aria-label="패치노트 페이지"><button className="button" disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}><ChevronLeft size={14} />이전</button><span>{page} 페이지</span><button className="button" disabled={!result.data.hasNext || loading} onClick={() => setPage(value => value + 1)}>다음<ChevronRight size={14} /></button></nav>}
  </section>
}
function noteDate(note: Note) {
  const value = note.publishedAt ?? note.createdAt ?? note.changes?.map(change => change.occurredAt).sort().at(-1)
  if (!value) return null
  const date = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : value + 'Z')
  return Number.isNaN(date.getTime()) ? null : { value: date.toISOString(), year: date.getFullYear(), label: date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }) }
}
function visibleChanges(note: Note) {
  return (note.changes ?? []).filter(change => change.status !== 'CONSOLIDATED' || note.status === 'PUBLISHED')
}
/** 패치노트 하나를 카드로 보여 준다. 열면 상세에서 항목 제목을 쓰고 공개한다. */
function NoteCard({ note }: { note: Note }) {
  const date = noteDate(note)
  const changes = visibleChanges(note)
  const published = note.status === 'PUBLISHED'
  const pending = published ? 0 : changes.filter(change => change.needsTitle && ['COMPLETED', 'MERGED'].includes(change.status)).length
  const counts = ([['FEATURE', '새 기능'], ['IMPROVE', '개선 사항'], ['FIX', '오류 수정']] as const)
    .map(([key, label]) => ({ key, label, count: changes.filter(change => change.category === key).length })).filter(item => item.count > 0)
  const excerpt = note.summary.split('\n').map(line => line.replace(/^[#>*\-\s]+/, '').trim()).find(Boolean)
  return <Link className="release-card" to={`/changes?note=${encodeURIComponent(note.id)}`} aria-label={`${note.title} 패치노트 열기`}>
    <div className="release-card-main">
      <div className="release-eyebrow"><span className={`release-status ${published ? 'is-published' : ''}`}>{published ? '공개됨' : '작성 중'}</span>{note.automatic ? '주간 업데이트' : '팀 소식'}{date && <time dateTime={date.value}>· {date.label}</time>}</div>
      <h3>{note.title}</h3>
      {excerpt && <p className="release-card-excerpt">{excerpt}</p>}
      {(counts.length > 0 || pending > 0) && <div className="release-card-stats">{counts.map(item => <span key={item.key} className={`release-kind release-kind-${item.key.toLowerCase()}`}>{item.label} {item.count}</span>)}{pending > 0 && <span className="release-card-pending">제목 작성 필요 {pending}</span>}</div>}
    </div>
    <ChevronRight size={18} className="release-card-arrow" />
  </Link>
}
function ReleaseEntry({ note, project, canWrite, busy, onEdit, onSaved }: { note: Note; project: string; canWrite: boolean; busy: boolean; onEdit: () => void; onSaved: (note: Note) => void }) {
  const date = noteDate(note)
  const count = visibleChanges(note).length
  return <article className="release-detail" id={`note-${note.id}`}>
    <header className="release-detail-head">
      <div className="release-detail-title">
        <div className="release-eyebrow"><span className={`release-status ${note.status === 'PUBLISHED' ? 'is-published' : ''}`}>{note.status === 'PUBLISHED' ? '공개됨' : '작성 중'}</span>{note.automatic ? '주간 업데이트' : '팀 업데이트'}{count > 0 && <span>· 변경 {count}개</span>}</div>
        <h3>{note.title}</h3>
        <p className="release-detail-meta">{date ? <time dateTime={date.value}>{date.label}</time> : <span>날짜 미정</span>}{note.author && <span>작성 {note.author}</span>}</p>
      </div>
      {canWrite && <button className="button release-edit" disabled={busy} onClick={onEdit}>내용 편집</button>}
    </header>
    {note.summary.trim() && <div className="release-intro"><MarkdownView source={note.summary} /></div>}
    <NoteChanges project={project} note={note} canWrite={canWrite} onSaved={onSaved} />
  </article>
}
function NoteChanges({ project, note, canWrite, onSaved }: { project: string; note: Note; canWrite: boolean; onSaved: (note: Note) => void }) {
  const categories = { FEATURE: '새 기능', IMPROVE: '개선 사항', FIX: '오류 수정' }
  const states = { COMPLETED: '작업 완료', MERGED: 'PR 병합', REOPENED: '다시 진행 중', ARCHIVED: '보관됨', CONSOLIDATED: '연결 작업으로 통합됨' }
  const changes = visibleChanges(note)
  if (!changes.length) return null
  const pending = note.status !== 'PUBLISHED' && changes.some(c => c.needsTitle && ['COMPLETED', 'MERGED'].includes(c.status))
  return <section className="release-changes" aria-label="패치노트에 모인 작업">
    <h4 className="release-changes-title">포함된 변경<span>{changes.length}</span></h4>
    {pending && <p className="release-pending-help">제목이 비어 있는 항목을 채우면 팀에 공개할 수 있어요.</p>}
    <ul className="release-change-list">{changes.map(change => <li className="release-change" key={change.id}>
      <div className="release-change-body">
        <div className="release-change-heading"><span className={`release-kind release-kind-${change.category.toLowerCase()}`}>{categories[change.category]}</span><h5>{change.title}</h5></div>
        <div className="release-change-meta"><time dateTime={change.occurredAt}>{noteDate({ ...note, publishedAt: change.occurredAt })?.label}</time><span>{states[change.status]}</span>{(change.issueId || change.pullRequestId) && <Link to={change.issueId ? `/issues?issue=${change.issueId}` : `/pull-requests?pr=${change.pullRequestId}`}>{change.issueId ? '관련 작업' : '관련 PR'}<ArrowUpRight size={12} /></Link>}</div>
        {change.summary.trim() && <details className="release-source"><summary>상세 내용</summary><MarkdownView source={change.summary} /></details>}
      </div>
      <div className="change-news-side">{change.needsTitle && note.status !== 'PUBLISHED' && <span className="change-news-badge is-pending">제목 작성 필요</span>}</div>
      {canWrite && note.status === 'DRAFT' && ['COMPLETED', 'MERGED'].includes(change.status) && <ChangeTitleEditor project={project} note={note} change={change} onSaved={onSaved} />}
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
  if (!editing) return <button type="button" className="button" onClick={() => { setTitle(change.needsTitle ? '' : change.title); setEditing(true) }}>{change.needsTitle ? '제목 작성' : '제목 수정'}</button>
  return <form className="dialog-form note-change-editor" onSubmit={event => { event.preventDefault(); void save() }}>
    <label>패치노트 제목<input autoFocus required maxLength={255} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} placeholder="예: 검색 결과를 더 빠르게 볼 수 있어요" /></label>
    {error && <p role="alert" className="form-error">{error}</p>}
    <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => setEditing(false)}>취소</button><button className="button button-dark" disabled={busy || !title.trim()}>{busy ? '저장 중…' : '제목 저장'}</button></div>
  </form>
}
