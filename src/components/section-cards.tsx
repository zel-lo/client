// Keep the dashboard-01 visual composition; surface collaboration bottlenecks.
import { CircleDot, GitMerge, GitPullRequest, UserRound, ArrowUpRight } from 'lucide-react'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function SectionCards({ unassigned, unlinked, reviewing, merged, period, onNavigate }: {
  unassigned: number; unlinked: number; reviewing: number; merged: number; period: string; onNavigate: (path: string) => void;
}) {
  const cards = [
    { label: '담당자 지정 필요', value: unassigned, icon: UserRound, tag: '이슈', caption: '누가 맡을지 정해 주세요', detail: '미완료 이슈 · 전체 기간', path: '/issues?focus=unassigned' },
    { label: 'PR 연결 필요', value: unlinked, icon: CircleDot, tag: '이슈 → PR', caption: '작업과 코드 변경 연결하기', detail: '미완료 이슈 · 전체 기간', path: '/issues?focus=unlinked' },
    { label: '코드 검토 대기', value: reviewing, icon: GitPullRequest, tag: '리뷰', caption: '팀의 확인을 기다리는 변경', detail: '열린 PR · 초안 제외 · 전체 기간', path: '/pull-requests?focus=pending' },
    { label: '최근 병합한 작업', value: merged, icon: GitMerge, tag: period, caption: '기본 브랜치에 반영됨', detail: '선택한 기간 · 서비스 배포와 별도', path: '/activity?type=merge' },
  ]
  return <section className="metrics-strip" aria-label="팀 작업 확인 현황">
    {cards.map(({ label, value, icon: Icon, tag, caption, detail, path }) => <Card className="metric" key={label}>
      <CardHeader><CardDescription className="metric-label">{label}</CardDescription><CardTitle className="metric-value">{value}</CardTitle><CardAction><span className="metric-tag"><Icon size={12} />{tag}</span></CardAction></CardHeader>
      <CardFooter className="metric-footer"><button className="metric-link" onClick={() => onNavigate(path)}>{caption}<ArrowUpRight size={14} /></button><small>{detail}</small></CardFooter>
    </Card>)}
  </section>
}
