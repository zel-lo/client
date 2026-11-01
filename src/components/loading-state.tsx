import './loading-state.css'
import { Skeleton } from './ui/skeleton'

export function LoadingState({ layout = 'list', label = '작업을 불러오는 중', rows = 5 }: { layout?: 'board' | 'list' | 'detail' | 'cards'; label?: string; rows?: number }) {
  return <div className={`loading-state loading-${layout}`} role="status" aria-label={label} aria-busy="true">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true">
      {layout === 'board' ? <div className="board-skeleton-grid">{Array.from({ length: 5 }, (_, column) => <div className="board-skeleton-column" key={column}>
        <Skeleton className="skeleton-column-title" />
        {Array.from({ length: column === 2 ? 2 : 3 }, (_, row) => <div className="skeleton-work-card" key={row}><Skeleton className="skeleton-reference" /><Skeleton className="skeleton-title" /><Skeleton className="skeleton-title short" /><Skeleton className="skeleton-caption" /><div className="skeleton-card-footer"><Skeleton className="skeleton-reference" /><Skeleton className="skeleton-avatar" /></div></div>)}
      </div>)}</div> : layout === 'detail' ? <><Skeleton className="skeleton-title" /><Skeleton className="skeleton-title short" /><Skeleton className="skeleton-detail-block" />{Array.from({ length: 3 }, (_, i) => <Skeleton className="skeleton-detail-field" key={i} />)}</> : layout === 'cards' ? <div className="skeleton-cards">{Array.from({ length: rows }, (_, i) => <div className="skeleton-work-card" key={i}><Skeleton className="skeleton-title short" /><Skeleton className="skeleton-detail-block" /></div>)}</div> : <div className="skeleton-table">{Array.from({ length: rows }, (_, i) => <div className="skeleton-table-row" key={i}><Skeleton className="skeleton-avatar" /><div><Skeleton className="skeleton-title" /><Skeleton className="skeleton-reference" /></div><Skeleton className="skeleton-badge" /></div>)}</div>}
    </div>
  </div>
}
