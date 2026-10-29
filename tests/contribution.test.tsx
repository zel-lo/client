import { describe, expect, it } from 'vitest'
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
})
