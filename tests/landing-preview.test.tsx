import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import App from '../src/App'

function RouteProbe() { const location = useLocation(); return <div data-testid="preview-route">{location.pathname}</div> }

describe('메인의 화면 미리보기', () => {
  it('메뉴·상태·작업·PR에 마우스를 올리거나 클릭해도 화면과 데이터가 바뀌지 않는다', async () => {
    const fetcher = vi.mocked(fetch)
    const user = userEvent.setup()
    render(<MemoryRouter><App /><RouteProbe /></MemoryRouter>)
    const preview = screen.getByRole('region', { name: '샘플 프로젝트 미리보기' })
    const detail = within(preview).getByRole('region', { name: '작업 상세 미리보기' })
    expect(within(detail).getByRole('heading', { name: '컬렉션 검색 응답 속도 개선' })).toBeInTheDocument()
    expect(within(preview).queryAllByRole('link')).toHaveLength(0)
    expect(within(preview).queryAllByRole('button')).toHaveLength(0)
    for (const item of ['알림함', '코드 검토', '진행 중', '컬렉션 공동 편집', '검색 결과를 더 빠르게 불러오는 작업']) {
      const target = within(preview).getByText(item, { exact: true })
      await user.hover(target)
      await user.click(target)
      await user.dblClick(target)
    }
    expect(screen.getByTestId('preview-route')).toHaveTextContent(/^\/$/)
    expect(within(detail).getByRole('heading', { name: '컬렉션 검색 응답 속도 개선' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem('gyeol.issues.v1')).toBeNull()
    expect(fetcher.mock.calls.some(([path, options]) => String(path).includes('/projects') || options?.method === 'POST' || options?.method === 'PATCH')).toBe(false)
    expect(screen.queryByRole('link', { name: /둘러보기/ })).not.toBeInTheDocument()
  })
})
