import { useEffect, useId, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, pointerWithin, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DropdownMenu, Popover } from 'radix-ui'
import { Archive, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, CircleDot, GitPullRequest, GripVertical, LayoutList, Columns3, LoaderCircle, Mic, MoreHorizontal, Plus, RotateCcw, UserRound, X } from 'lucide-react'
import type { IssueStatus } from '../data/work-items'
import { shiftWeek, startOfWeek, weekLabel } from '../lib/work-weeks'
import { useWorkWeek } from '../hooks/use-work-week'
import { LoadingState } from './loading-state'

export const boardStates: { id: IssueStatus; label: string; hint: string; icon: typeof Circle }[] = [
  { id: 'backlog', label: '백로그', hint: '다음 계획을 기다리는 일', icon: Archive },
  { id: 'todo', label: '이번에 할 일', hint: '이번 주에 함께 할 일이에요', icon: Circle },
  { id: 'in_progress', label: '작업 중', hint: '차근차근 진행하고 있어요', icon: CircleDot },
  { id: 'in_review', label: '검토 중', hint: '팀의 확인을 기다리고 있어요', icon: GitPullRequest },
  { id: 'done', label: '완료', hint: '이번 주에 마무리한 일이에요', icon: CheckCircle2 },
]
export type BoardItem = {
  id: string; key: string; title: string; status: IssueStatus; priority: 'high' | 'medium' | 'low'
  repositoryId: string; repositoryName: string; number?: number | null; assignee: string | null
  sourceLabel: string; meetingDate?: string | null; plannedWeekStart: string; completedAt?: string | null
  attention?: { label: string; tone: 'warning' | 'danger' | 'info' | 'success' }
  references?: { id: string; label: string }[]; locked?: boolean
}
export type AssigneePage = { items: { login: string }[]; hasNext: boolean }
export type BoardMove = { id: string; status: IssueStatus; beforeId: string | null }
export type BoardActions = {
  onOpen: (id: string) => void
  onMove: (move: BoardMove) => Promise<void> | void
  onAssign: (id: string, login: string | null) => Promise<void> | void
  loadAssignees: (repositoryId: string, page: number, signal: AbortSignal) => Promise<AssigneePage>
  onReference?: (id: string) => void
}

export function WorkViewToggle({ view, onChange, disabled = false }: { view: 'board' | 'list'; disabled?: boolean; onChange: (view: 'board' | 'list') => void }) {
  return <div className="segmented-tabs work-view-toggle" role="group" aria-label="작업 보기 방식">
    <button type="button" disabled={disabled} aria-pressed={view === 'board'} className={view === 'board' ? 'selected' : ''} onClick={() => onChange('board')}><Columns3 size={15} />보드</button>
    <button type="button" disabled={disabled} aria-pressed={view === 'list'} className={view === 'list' ? 'selected' : ''} onClick={() => onChange('list')}><LayoutList size={15} />목록</button>
  </div>
}

export function WeekNavigation({ week, onChange, disabled = false }: { week: string; onChange: (week: string) => void; disabled?: boolean }) {
  const current = useWorkWeek()
  return <div className="week-navigation">
    <div className="week-heading"><span className="week-eyebrow"><CalendarDays size={13} />{week.slice(0, 4)}년 · 주간 계획</span><div><h2>{weekLabel(week)}</h2>{week === current ? <span className="week-current">이번 주</span> : <button className="text-button" disabled={disabled} onClick={() => onChange(current)}>이번 주로</button>}</div></div>
    <div className="week-actions"><button type="button" className="icon-button" aria-label="이전 주" disabled={disabled} onClick={() => onChange(shiftWeek(week, -1))}><ChevronLeft size={18} /></button><label className="week-date-picker" title="주차 선택"><CalendarDays size={16} /><input type="date" aria-label="주차 선택" value={week} disabled={disabled} onChange={event => { if (event.target.value) onChange(startOfWeek(event.target.value)) }} /></label><button type="button" className="icon-button" aria-label="다음 주" disabled={disabled} onClick={() => onChange(shiftWeek(week, 1))}><ChevronRight size={18} /></button></div>
  </div>
}

function AssigneePicker({ item, disabled, onAssign, loadAssignees }: { item: BoardItem; disabled: boolean } & Pick<BoardActions, 'onAssign' | 'loadAssignees'>) {
  const [open, setOpen] = useState(false)
  const [people, setPeople] = useState<{ login: string }[]>([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true); setError('')
    void loadAssignees(item.repositoryId, page, controller.signal).then(result => {
      if (controller.signal.aborted) return
      setPeople(current => [...new Map((page === 1 ? result.items : [...current, ...result.items]).map(person => [person.login, person])).values()]); setHasNext(result.hasNext)
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '팀원을 불러오지 못했어요.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [open, page, retry, item.repositoryId, loadAssignees])
  async function select(login: string | null) {
    if (saving) return
    setSaving(true); setError('')
    try { await onAssign(item.id, login); if (mounted.current) setOpen(false) }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '담당자를 저장하지 못했어요.') }
    finally { if (mounted.current) setSaving(false) }
  }
  return <Popover.Root open={open} onOpenChange={value => { if (saving) return; setOpen(value); if (value) { setPage(1); setPeople([]); setQuery(''); setError('') } }}>
    <Popover.Trigger asChild><button type="button" className={`board-assignee ${item.assignee ? 'has-assignee' : ''}`} disabled={disabled} aria-label={`${item.key} 담당자 지정${item.assignee ? `, 현재 ${item.assignee}` : ''}`}>
      {item.assignee ? <><span className="board-avatar" aria-hidden="true">{item.assignee.slice(0, 2)}</span><span>{item.assignee}</span></> : <><UserRound size={13} /><span>담당자 지정</span></>}
    </button></Popover.Trigger>
    <Popover.Portal><Popover.Content className="board-popover assignee-popover" sideOffset={8} align="end" aria-label="담당자 지정" onEscapeKeyDown={event => { if (saving) event.preventDefault() }} onInteractOutside={event => { if (saving) event.preventDefault() }}>
      <div className="board-popover-heading"><strong>담당자 지정</strong><Popover.Close asChild><button className="icon-button tiny" disabled={saving} aria-label="담당자 선택 닫기"><X size={15} /></button></Popover.Close></div>
      <input aria-label="팀원 검색" placeholder="팀원 검색" value={query} onChange={event => setQuery(event.target.value)} />
      {error && <div className="board-picker-error" role="alert">{error}<button type="button" onClick={() => setRetry(value => value + 1)}>다시 불러오기</button></div>}
      <div className="assignee-options" aria-busy={loading || saving}>
        <button type="button" disabled={saving || loading} onClick={() => void select(null)}><UserRound size={15} /><span>미지정</span>{!item.assignee && <Check size={14} />}</button>
        {people.filter(person => person.login.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(person => <button type="button" key={person.login} aria-label={person.login} disabled={saving} onClick={() => void select(person.login)}><span className="board-avatar" aria-hidden="true">{person.login.slice(0, 2)}</span><span>{person.login}</span>{item.assignee === person.login && <Check size={14} />}</button>)}
        {loading && <LoadingState rows={3} label="지정 가능한 팀원을 불러오는 중" />}
        {!loading && !error && !people.filter(person => person.login.toLocaleLowerCase().includes(query.toLocaleLowerCase())).length && <p className="board-picker-empty">{query ? '검색한 팀원이 없어요.' : '지정 가능한 팀원이 없어요.'}</p>}
      </div>
      {hasNext && <button type="button" className="button full-width" disabled={loading || saving} onClick={() => setPage(value => value + 1)}>팀원 더 보기</button>}
      {saving && <p className="muted small" role="status">담당자를 저장하고 있어요…</p>}
    </Popover.Content></Popover.Portal>
  </Popover.Root>
}

function CardContent({ item, week, canWrite, busy, actions, overlay = false, children }: { item: BoardItem; week: string; canWrite: boolean; busy: boolean; actions: BoardActions; overlay?: boolean; children?: ReactNode }) {
  const carry = item.status !== 'backlog' && item.status !== 'done' && item.plannedWeekStart < week
  return <>
    <div className="board-card-top"><span className="board-card-key mono">{item.key}</span>{item.priority === 'high' && <span className="board-priority">높음</span>}{children}</div>
    <button type="button" className="board-card-title" aria-label={`${item.key} ${item.title}`} tabIndex={overlay ? -1 : 0} onClick={() => actions.onOpen(item.id)}>{item.title}</button>
    <div className="board-card-context"><span title={item.repositoryName}>{item.repositoryName}{item.number ? `#${item.number}` : ''}</span>{carry && <span className="board-carry" title={`원래 계획: ${weekLabel(item.plannedWeekStart)}`}><RotateCcw size={11} />{shiftWeek(week, -1) === item.plannedWeekStart ? '전주 이월' : '이전 주 이월'}</span>}</div>
    {item.attention && <div className={`board-attention board-attention-${item.attention.tone}`}><CircleDot size={12} /><span>{item.attention.label}</span></div>}
    <div className="board-card-footer"><div className="board-card-links">{item.references?.length ? item.references.slice(0, 2).map(reference => <button type="button" tabIndex={overlay ? -1 : 0} key={reference.id} onClick={() => actions.onReference?.(reference.id)}><GitPullRequest size={12} />{reference.label}</button>) : <span className="board-card-source" title={item.meetingDate ? `${item.sourceLabel} · ${item.meetingDate}` : item.sourceLabel}>{item.sourceLabel}</span>}</div>
      {overlay ? <span className="board-assignee">{item.assignee ?? '담당자 지정'}</span> : <AssigneePicker item={item} disabled={!canWrite || busy || !!item.locked} onAssign={actions.onAssign} loadAssignees={actions.loadAssignees} />}
    </div>
  </>
}

function WorkCard({ item, week, canWrite, busy, actions }: { item: BoardItem; week: string; canWrite: boolean; busy: boolean; actions: BoardActions }) {
  const disabled = !canWrite || busy || !!item.locked
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { status: item.status, type: 'card' }, disabled })
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition } as CSSProperties} className={`board-card ${isDragging ? 'is-dragging' : ''} ${item.locked ? 'is-locked' : ''}`} aria-label={item.key}>
    <CardContent item={item} week={week} canWrite={canWrite} busy={busy} actions={actions}>
      {busy && <LoaderCircle className="board-saving" size={14} aria-label="저장 중" />}
      {canWrite && <><button type="button" ref={setActivatorNodeRef} className="board-drag-handle" {...attributes} {...listeners} disabled={disabled} aria-label={`${item.key} 끌어서 옮기기`}><GripVertical size={15} /></button><DropdownMenu.Root><DropdownMenu.Trigger asChild><button type="button" className="board-card-menu" disabled={disabled} aria-label={`${item.key} 작업 메뉴`}><MoreHorizontal size={17} /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="board-popover board-menu" sideOffset={6} align="end"><DropdownMenu.Label>단계 옮기기</DropdownMenu.Label>{boardStates.map(state => <DropdownMenu.Item key={state.id} disabled={state.id === item.status} onSelect={() => void actions.onMove({ id: item.id, status: state.id, beforeId: null })}><state.icon size={14} />{state.label}{state.id === 'in_progress' || state.id === 'in_review' ? '으로' : '로'} 이동{state.id === item.status && <Check size={13} />}</DropdownMenu.Item>)}</DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></>}
    </CardContent>
  </article>
}

function BoardColumn({ state, items, week, canWrite, busyId, disabled, actions, onCreate }: { state: typeof boardStates[number]; items: BoardItem[]; week: string; canWrite: boolean; busyId: string | null; disabled: boolean; actions: BoardActions; onCreate?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${state.id}`, data: { status: state.id, type: 'column' }, disabled: !canWrite || disabled })
  return <section ref={setNodeRef} className={`board-column board-column-${state.id} ${isOver ? 'is-over' : ''}`} aria-label={`${state.label} 열`}>
    <div className="board-column-heading"><state.icon size={16} /><h3>{state.label}</h3><span className="board-column-count">{items.length}</span>{onCreate && canWrite && state.id === 'todo' && <button type="button" className="icon-button tiny" aria-label="이번 주 작업 추가" disabled={disabled} onClick={onCreate}><Plus size={15} /></button>}</div><p className="board-column-hint">{state.hint}</p>
    <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}><div className="board-column-cards">{items.map(item => <WorkCard key={item.id} item={item} week={week} canWrite={canWrite && !disabled && !busyId} busy={busyId === item.id} actions={actions} />)}
      {!items.length && <div className="board-column-empty"><state.icon size={20} strokeWidth={1.3} /><p>{state.id === 'done' ? '마무리한 일이 여기에 모여요' : state.id === 'backlog' ? '다음에 할 일을 모아두세요' : '아직 작업이 없어요'}</p>{canWrite && <span>카드를 이곳으로 옮겨주세요</span>}</div>}
    </div></SortableContext>
  </section>
}

const collisionDetection: CollisionDetection = args => {
  const collisions = pointerWithin(args)
  if (collisions.length) {
    const cards = collisions.filter(collision => args.droppableContainers.find(container => container.id === collision.id)?.data.current?.type === 'card')
    return cards.length ? cards : collisions
  }
  // Outside the board cancels pointer drops; keyboard movement uses geometric targets.
  return args.pointerCoordinates ? [] : closestCorners(args)
}

export function TeamBoard({ items, week, actions, canWrite = true, busyId = null, disabled = false, onCreate }: { items: BoardItem[]; week: string; actions: BoardActions; canWrite?: boolean; busyId?: string | null; disabled?: boolean; onCreate?: () => void }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [meeting, setMeeting] = useState(false)
  const [attentionOnly, setAttentionOnly] = useState(false)
  const [showBacklog, setShowBacklog] = useState(true)
  const id = useId()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const attention = items.filter(item => item.status !== 'done' && (item.attention?.tone === 'danger' || item.attention?.tone === 'warning' || !item.assignee))
  const filtered = attentionOnly ? items.filter(item => attention.some(candidate => candidate.id === item.id)) : items
  const active = items.find(item => item.id === activeId)
  async function drop(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id || !canWrite || disabled || busyId) return
    const item = items.find(item => item.id === active.id)
    const status = over.data.current?.status as IssueStatus | undefined
    if (!item || !status || item.locked) return
    const target = items.find(item => item.id === over.id)
    let beforeId = target?.id ?? null
    if (target && item.status === status) {
      const column = items.filter(candidate => candidate.status === status)
      if (column.findIndex(candidate => candidate.id === item.id) < column.findIndex(candidate => candidate.id === target.id)) beforeId = column[column.findIndex(candidate => candidate.id === target.id) + 1]?.id ?? null
    }
    await actions.onMove({ id: item.id, status, beforeId })
  }
  return <div className={`team-board ${meeting ? 'meeting-mode' : ''}`}>
    <div className="board-overview"><div className="board-summary"><span>{items.filter(item => item.status !== 'backlog' && item.status !== 'done').length}개 진행 중</span><i /><span><RotateCcw size={12} />{items.filter(item => item.status !== 'backlog' && item.status !== 'done' && item.plannedWeekStart < week).length}개 이월</span><i /><span className="board-summary-done"><CheckCircle2 size={12} />{items.filter(item => item.status === 'done').length}개 완료</span></div><div className="board-display-actions"><button type="button" aria-pressed={showBacklog} onClick={() => setShowBacklog(value => !value)}><Archive size={13} />백로그 {items.filter(item => item.status === 'backlog').length}</button><button type="button" aria-pressed={meeting} onClick={() => { setMeeting(value => !value); setAttentionOnly(false) }}><Mic size={13} />회의 모드</button></div></div>
    {meeting && <div className="meeting-summary"><div><span className="week-eyebrow"><Mic size={12} />이번 회의에서 함께 확인해요</span><strong>먼저 확인할 작업이 {attention.length}개 있어요</strong><p>담당자 미지정과 확인이 필요한 작업을 모았어요.</p></div><button className="button" type="button" aria-pressed={attentionOnly} onClick={() => setAttentionOnly(value => !value)}>{attentionOnly ? '모든 작업 보기' : '확인할 작업만 보기'}<ArrowRight size={14} /></button></div>}
    <DndContext id={id} sensors={sensors} collisionDetection={collisionDetection} onDragStart={event => setActiveId(String(event.active.id))} onDragCancel={() => setActiveId(null)} onDragEnd={event => { void drop(event) }} accessibility={{ screenReaderInstructions: { draggable: 'Space 또는 Enter로 카드를 들고, 방향키로 옮긴 뒤 다시 눌러 놓으세요. Escape로 취소합니다.' }, announcements: {
      onDragStart: ({ active }) => `${items.find(item => item.id === active.id)?.key ?? '작업'}을 들었어요.`,
      onDragOver: ({ over }) => over ? `${boardStates.find(state => state.id === over.data.current?.status)?.label ?? ''} 위치예요.` : '보드 밖이에요. 놓으면 취소해요.',
      onDragEnd: ({ over }) => over ? '작업 위치를 저장해요.' : '이동을 취소했어요.',
      onDragCancel: () => '이동을 취소했어요.',
    } }}>
      <div className="board-scroll" tabIndex={0} role="region" aria-label="주간 작업 보드" aria-describedby={`${id}-help`}><div className={`board-columns ${showBacklog ? 'with-backlog' : ''}`}>
        {boardStates.filter(state => showBacklog || state.id !== 'backlog').map(state => <BoardColumn key={state.id} state={state} items={filtered.filter(item => item.status === state.id)} week={week} canWrite={canWrite} busyId={busyId} disabled={disabled} actions={actions} onCreate={onCreate} />)}
      </div></div>
      <DragOverlay dropAnimation={null}>{active && <div className="board-card board-card-overlay" aria-hidden="true"><CardContent item={active} week={week} canWrite={false} busy={false} actions={actions} overlay /></div>}</DragOverlay>
    </DndContext>
    <p className="board-help" id={`${id}-help`}>{canWrite ? <><GripVertical size={12} />카드의 손잡이를 끌어 순서와 단계를 정하세요. 작업 메뉴로도 옮길 수 있어요.</> : '조회 전용으로 팀의 진행 상황을 보고 있어요.'}<span>미완료 작업은 다음 주에도 이어져요.</span></p>
  </div>
}
