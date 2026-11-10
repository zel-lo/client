import { Link } from 'react-router-dom'
import { ArrowUpRight, RefreshCw } from 'lucide-react'
import ContributionSkyline, { buildGrid, computeStats, dayMs } from './ui/contribution-skyline'
import type { ContributionDay } from './ui/contribution-skyline'
import { LoadingState } from './loading-state'
import './team-contributions.css'

const palette = { light: ['#DDE5FF', '#AEBFFF', '#6C8BFF', '#2F5BFF'], dark: ['#263557', '#3E568D', '#5876C3', '#7C9BFF'] }

export function TeamContributions({ days, loading = false, error = '', onRetry, endDate = new Date().toISOString().slice(0, 10), demo = false }: {
  days: ContributionDay[] | null; loading?: boolean; error?: string; onRetry?: () => void; endDate?: string; demo?: boolean
}) {
  const end = dayMs(endDate)
  const start = new Date(end)
  start.setUTCFullYear(start.getUTCFullYear() - 1)
  start.setUTCDate(start.getUTCDate() + 1)
  const startDate = start.toISOString().slice(0, 10)
  const total = days ? computeStats(buildGrid(days, end, 0, dayMs(startDate)).cells).total : 0

  return <section className="weekly-card team-contributions" aria-labelledby="team-contributions-heading" data-tour="team-contributions">
    <div className="weekly-card-heading"><div><h2 id="team-contributions-heading">팀이 쌓아온 활동</h2><p className="team-contributions-description">작업 완료와 팀원 초대 등, zello에서 남긴 기록을 모았어요.</p></div><span className="team-contributions-period">최근 1년{demo && ' · 샘플'}</span></div>
    {error && <div className="connection-error" role="alert"><span>활동 기록을 새로 불러오지 못했어요. {error}</span><button type="button" className="button" disabled={loading} onClick={onRetry}><RefreshCw size={14} />다시 불러오기</button></div>}
    {days === null ? !error && <LoadingState layout="activity" label="팀의 활동 기록을 불러오는 중" /> : <>
      <ContributionSkyline data={days} startDate={startDate} endDate={endDate} defaultView="2d" palette={palette} showStats={false} locale="ko-KR" unit="개 활동" unitPlural="개 활동"
        title={<><strong className="team-contributions-total">{total.toLocaleString('ko-KR')}</strong><span className="team-contributions-unit">건의 팀 활동</span>{loading && <span className="team-contributions-updating" role="status">갱신 중…</span>}</>}
        footer="날짜에 마우스를 올리거나 방향키로 하루의 활동 수를 확인하세요." className="team-contributions-chart" />
      {total === 0 && <p className="team-contributions-empty">아직 기록된 활동이 없어요. 작업을 진행하면 이곳에 팀의 발자취가 쌓여요.</p>}
    </>}
    <div className="team-contributions-footer"><div className="team-contributions-note"><p>{demo ? '화면을 둘러보기 위한 샘플 활동이에요.' : 'zello에 남긴 팀 활동이에요. GitHub 커밋 수와는 달라요.'}</p><details className="activity-count-help"><summary>집계 기준</summary><p>작업 완료·담당자 배정·팀원 초대·업데이트 공개 등 zello에 저장된 활동을 세어요. 하루는 세계 표준시(UTC) 기준으로 구분해, 한국 시간으로 오전 9시에 날짜가 바뀌어요.</p></details></div><Link to="/changes?view=history" className="weekly-text-link">개발 기록 보기<ArrowUpRight size={14} /></Link></div>
  </section>
}
