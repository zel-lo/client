import './loading-state.css'
import { Skeleton } from './ui/skeleton'

type LoadingLayout = 'board' | 'list' | 'detail' | 'cards' | 'settings' | 'dashboard' | 'activity'

function SettingsSkeleton() {
  return <div className="settings-skeleton">
    <div className="settings-skeleton-panel"><Skeleton className="skeleton-column-title" />
      {[false, true].map((multiline, index) => <div className="settings-skeleton-field" key={index}><Skeleton className="skeleton-reference" /><Skeleton className={multiline ? 'skeleton-settings-textarea' : 'skeleton-settings-input'} /></div>)}
      <div className="skeleton-settings-footer"><Skeleton className="skeleton-settings-button" /></div>
    </div>
    <div className="settings-skeleton-panel"><Skeleton className="skeleton-column-title" /><div className="skeleton-period-grid">{[0, 1, 2].map(index => <div key={index}><Skeleton className="skeleton-reference" /><Skeleton className="skeleton-title" /></div>)}</div></div>
  </div>
}

function DashboardSkeleton() {
  return <div className="dashboard-skeleton"><div className="skeleton-dashboard-toolbar"><Skeleton className="skeleton-badge" /><Skeleton className="skeleton-badge" /></div>
    <div className="skeleton-dashboard-next"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-title short" /></div>
    <Skeleton className="skeleton-dashboard-progress" />
    <div className="skeleton-dashboard-grid">{[0, 1].map(index => <div className="settings-skeleton-panel" key={index}><Skeleton className="skeleton-column-title" />{[0, 1, 2].map(row => <Skeleton className="skeleton-detail-field" key={row} />)}</div>)}</div>
  </div>
}

export function LoadingState({ layout = 'list', label = '작업을 불러오는 중', rows = 5 }: { layout?: LoadingLayout; label?: string; rows?: number }) {
  return <div className={`loading-state loading-${layout}`} role="status" aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">
      {layout === 'settings' ? <SettingsSkeleton /> : layout === 'dashboard' ? <DashboardSkeleton /> : layout === 'activity' ? <div className="skeleton-activity-grid">{Array.from({ length: 52 }, (_, column) => <div key={column}>{Array.from({ length: 7 }, (_, day) => <Skeleton className="skeleton-activity-cell" key={day} />)}</div>)}</div> : layout === 'board' ? <div className="board-skeleton-grid">{Array.from({ length: 4 }, (_, column) => <div className="board-skeleton-column" key={column}>
        <Skeleton className="skeleton-column-title" />
        {Array.from({ length: column === 2 ? 2 : 3 }, (_, row) => <div className="skeleton-work-card" key={row}><Skeleton className="skeleton-reference" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-title short" /><Skeleton className="skeleton-caption" /><div className="skeleton-card-footer"><Skeleton className="skeleton-reference" /><Skeleton className="skeleton-avatar" /></div></div>)}
      </div>)}</div> : layout === 'detail' ? <><Skeleton className="skeleton-title" /><Skeleton className="skeleton-title short" /><Skeleton className="skeleton-detail-block" />{Array.from({ length: 3 }, (_, i) => <Skeleton className="skeleton-detail-field" key={i} />)}</> : layout === 'cards' ? <div className="skeleton-cards">{Array.from({ length: rows }, (_, i) => <div className="skeleton-work-card" key={i}><Skeleton className="skeleton-title short" /><Skeleton className="skeleton-detail-block" /></div>)}</div> : <div className="skeleton-table">{Array.from({ length: rows }, (_, i) => <div className="skeleton-table-row" key={i}><Skeleton className="skeleton-avatar" /><div><Skeleton className="skeleton-title" /><Skeleton className="skeleton-reference" /></div><Skeleton className="skeleton-badge" /></div>)}</div>}
    </div>
  </div>
}
