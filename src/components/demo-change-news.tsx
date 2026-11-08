import { ArrowUpRight } from 'lucide-react'
import type { Activity, PatchNote } from '../data/mock'
import { ChangeNewsList } from './change-news-list'
import type { ChangeNewsItem } from './change-news-list'

export function DemoChangeNews({ notes, activities, repository, onSelect }: { notes: PatchNote[]; activities: Activity[]; repository: string; onSelect: (note: PatchNote) => void }) {
  const items: ChangeNewsItem[] = notes.flatMap<ChangeNewsItem>(note => {
    const changes = activities.filter(activity => note.activityIds.includes(activity.id) && (repository === 'all' || activity.repo === repository))
    const metadata = <button type="button" onClick={() => onSelect(note)}>{note.title} · {note.status === 'published' ? '공개됨' : '작성 중'}<ArrowUpRight size={12} /></button>
    if (!changes.length) return [{ id: note.id, category: 'TEAM', date: note.date, title: note.title, metadata }]
    return changes.map(activity => ({ id: `${note.id}:${activity.id}`, category: activity.noteType === 'feature' ? 'FEATURE' : activity.noteType === 'fix' ? 'FIX' : 'IMPROVE', date: activity.date, title: activity.title, metadata }))
  })
  return <ChangeNewsList items={items} />
}
