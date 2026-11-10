import './loading-state.css'
import { Skeleton } from './ui/skeleton'

type LoadingLayout = 'board' | 'list' | 'detail' | 'cards' | 'settings' | 'dashboard' | 'activity' | 'notes'

function SettingsSkeleton() {
  return <div className="settings-skeleton">
    <div className="settings-skeleton-panel"><Skeleton className="skeleton-column-title" />
      {[false, true].map((multiline, index) => <div className="settings-skeleton-field" key={index}><Skeleton className="skeleton-reference" /><Skeleton className={multiline ? 'skeleton-settings-textarea' : 'skeleton-settings-input'} /></div>)}
      <div className="skeleton-settings-footer"><Skeleton className="skeleton-settings-button" /></div>
    </div>
    <div className="settings-skeleton-panel"><Skeleton className="skeleton-column-title" /><div className="skeleton-period-grid">{[0, 1, 2].map(index => <div key={index}><Skeleton className="skeleton-reference" /><Skeleton className="skeleton-title" /></div>)}</div></div>
  </div>
}

/** 전체 현황: 진행률 카드, 확인할 일·업무 담당, 완료 목록 순서 */
function DashboardSkeleton() {
  const rows = (count: number) => Array.from({ length: count }, (_, row) => <div className="skeleton-row" key={row}><Skeleton className="skeleton-icon" /><div className="skeleton-lines"><Skeleton className="skeleton-line sk-w-30" /><Skeleton className="skeleton-line strong sk-w-60" /><Skeleton className="skeleton-line sk-w-40" /></div></div>)
  return <div className="dashboard-skeleton">
    <div className="skeleton-dashboard-toolbar"><Skeleton className="skeleton-pill sk-w-picker" /><Skeleton className="skeleton-line sk-w-refresh" /></div>
    <div className="skeleton-panel skeleton-progress">
      <div>
        <Skeleton className="skeleton-line strong sk-w-heading" />
        <Skeleton className="skeleton-number" />
        <Skeleton className="skeleton-bar" />
        <div className="skeleton-counts">{[0, 1, 2].map(index => <div key={index}><Skeleton className="skeleton-line sk-w-label" /><Skeleton className="skeleton-count" /></div>)}</div>
      </div>
      <div className="skeleton-highlights">{[0, 1].map(index => <div className="skeleton-row" key={index}><Skeleton className="skeleton-icon large" /><div className="skeleton-lines"><Skeleton className="skeleton-line sk-w-label" /><Skeleton className="skeleton-count" /><Skeleton className="skeleton-line sk-w-60" /></div></div>)}</div>
    </div>
    <div className="skeleton-dashboard-grid">
      <div className="skeleton-panel"><Skeleton className="skeleton-line strong sk-w-heading" /><div className="skeleton-chips">{[0, 1, 2, 3].map(index => <Skeleton className="skeleton-pill" key={index} />)}</div>{rows(3)}</div>
      <div className="skeleton-panel"><Skeleton className="skeleton-line strong sk-w-heading" />{rows(2)}</div>
    </div>
    <div className="skeleton-panel"><Skeleton className="skeleton-line strong sk-w-heading" />{rows(1)}</div>
  </div>
}

/** 변경 소식: 패치노트 카드(상태·종류, 제목, 본문 첫 줄, 분류 칩) */
function NotesSkeleton({ rows }: { rows: number }) {
  return <div className="skeleton-notes">{Array.from({ length: rows }, (_, i) => <div className="skeleton-panel skeleton-note" key={i}>
    <div className="skeleton-row"><Skeleton className="skeleton-pill small" /><Skeleton className="skeleton-line sk-w-label" /></div>
    <Skeleton className={`skeleton-line strong ${i % 2 ? 'sk-w-40' : 'sk-w-60'}`} />
    <Skeleton className="skeleton-line sk-w-60" />
    <div className="skeleton-chips"><Skeleton className="skeleton-pill small" />{i % 2 === 0 && <Skeleton className="skeleton-pill small" />}</div>
  </div>)}</div>
}

/** 팀 작업 보드: 열 머리와 실제 카드 구조(저장소·제목·작업 번호·담당자)를 따른다 */
function BoardSkeleton() {
  return <div className="board-skeleton-grid">{Array.from({ length: 4 }, (_, column) => <div className="board-skeleton-column" key={column}>
    <div className="skeleton-column-head"><Skeleton className="skeleton-dot" /><Skeleton className="skeleton-line strong sk-w-col" /><Skeleton className="skeleton-pill tiny" /></div>
    <Skeleton className="skeleton-line sk-w-hint" />
    {Array.from({ length: column === 3 ? 1 : column === 2 ? 2 : 3 }, (_, row) => <div className="skeleton-work-card" key={row}>
      <div className="skeleton-card-top"><Skeleton className="skeleton-line sk-w-repo" /><Skeleton className="skeleton-dot" /></div>
      <Skeleton className={`skeleton-line strong ${row % 2 ? 'sk-w-60' : 'sk-w-80'}`} />
      <Skeleton className="skeleton-line sk-w-key" />
      <div className="skeleton-card-footer"><Skeleton className="skeleton-line sk-w-source" /><span><Skeleton className="skeleton-avatar" /><Skeleton className="skeleton-line sk-w-name" /></span></div>
    </div>)}
  </div>)}</div>
}

/** 목록: 아이콘·제목·보조 줄과 오른쪽 상태 배지 */
function ListSkeleton({ rows }: { rows: number }) {
  return <div className="skeleton-table">{Array.from({ length: rows }, (_, i) => <div className="skeleton-table-row" key={i}>
    <Skeleton className="skeleton-dot" />
    <div className="skeleton-lines"><Skeleton className={`skeleton-line strong ${i % 3 === 1 ? 'sk-w-40' : 'sk-w-60'}`} /><Skeleton className="skeleton-line sk-w-30" /></div>
    <Skeleton className="skeleton-pill" />
    <span className="skeleton-person"><Skeleton className="skeleton-avatar" /><Skeleton className="skeleton-line sk-w-name" /></span>
  </div>)}</div>
}

export function LoadingState({ layout = 'list', label = '작업을 불러오는 중', rows = 5 }: { layout?: LoadingLayout; label?: string; rows?: number }) {
  return <div className={`loading-state loading-${layout}`} role="status" aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">
      {layout === 'settings' ? <SettingsSkeleton />
        : layout === 'dashboard' ? <DashboardSkeleton />
        : layout === 'activity' ? <div className="skeleton-activity-grid">{Array.from({ length: 52 }, (_, column) => <div key={column}>{Array.from({ length: 7 }, (_, day) => <Skeleton className="skeleton-activity-cell" key={day} />)}</div>)}</div>
        : layout === 'board' ? <BoardSkeleton />
        : layout === 'notes' ? <NotesSkeleton rows={Math.min(rows, 3)} />
        : layout === 'detail' ? <div className="skeleton-detail"><Skeleton className="skeleton-line sk-w-30" /><Skeleton className="skeleton-heading" /><Skeleton className="skeleton-line sk-w-40" /><Skeleton className="skeleton-detail-block" />{Array.from({ length: 3 }, (_, i) => <div className="skeleton-detail-field" key={i}><Skeleton className="skeleton-line sk-w-label" /><Skeleton className="skeleton-field" /></div>)}</div>
        : layout === 'cards' ? <div className="skeleton-cards">{Array.from({ length: rows }, (_, i) => <div className="skeleton-panel" key={i}><div className="skeleton-row"><Skeleton className="skeleton-icon" /><div className="skeleton-lines"><Skeleton className="skeleton-line strong sk-w-60" /><Skeleton className="skeleton-line sk-w-40" /></div></div><Skeleton className="skeleton-line sk-w-80" /><Skeleton className="skeleton-line sk-w-60" /></div>)}</div>
        : <ListSkeleton rows={rows} />}
    </div>
  </div>
}
