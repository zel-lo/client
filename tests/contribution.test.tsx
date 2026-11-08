import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { TeamContributions } from '../src/components/team-contributions'
import { buildGrid, computeStats, dayMs } from '../src/components/ui/contribution-skyline'

describe('연간 활동 집계', () => {
  it('서로 다른 저장소에서 수집한 같은 날짜의 활동을 합산한다', () => {
    const { cells } = buildGrid([
      { date: '2026-10-26', count: 3 },
      { date: '2026-10-26', count: 5 },
      { date: '2026-10-27', count: 2 },
    ], dayMs('2026-10-27'), 0, dayMs('2026-10-25'))
    expect(cells.find(c => c.date === '2026-10-26')?.count).toBe(8)
    expect(computeStats(cells).total).toBe(10)
  })
  it('선택한 달력 연도의 첫 주부터 오늘까지 표시하고 범위 밖 활동은 집계하지 않는다', () => {
    const { cells } = buildGrid([
      { date: '2025-12-25', count: 100 },
      { date: '2026-01-01', count: 4 },
      { date: '2026-10-27', count: 7 },
      { date: '2026-10-28', count: 200 },
    ], dayMs('2026-10-27'), 0, dayMs('2026-01-01'))
    expect(cells[0].date).toBe('2025-12-28')
    expect(cells.at(-1)?.date).toBe('2026-10-27')
    expect(computeStats(cells).total).toBe(11)
  })
  it('실제 빈 활동은 임의의 샘플로 채우지 않으며 평면·3D 보기와 한국어 안내를 제공한다', async () => {
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    try {
      render(<MemoryRouter><TeamContributions days={[]} endDate="2026-11-08" /></MemoryRouter>)
      expect(screen.getByRole('heading', { name: '0건의 팀 활동' })).toBeInTheDocument()
      expect(screen.getByText(/아직 기록된 활동이 없어요/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '평면 잔디' })).toHaveAttribute('aria-pressed', 'true')
      await userEvent.click(screen.getByRole('button', { name: '3D 잔디' }))
      expect(screen.getByRole('button', { name: '3D 잔디' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('img')).toHaveAccessibleName(/3D 잔디.*방향키/)
      expect(screen.getByRole('link', { name: '개발 기록 보기' })).toHaveAttribute('href', '/changes?view=history')
    } finally { context.mockRestore() }
  })
})
