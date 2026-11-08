import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpMenu } from '../src/components/help-menu'
import * as tours from '../src/lib/tours'

describe('도움말 메뉴', () => {
  afterEach(() => vi.restoreAllMocks())

  it('둘러보기가 있는 화면에서 메뉴를 고르면 둘러보기를 시작한다', async () => {
    const start = vi.spyOn(tours, 'startTour').mockReturnValue(true)
    render(<MemoryRouter><HelpMenu pathname="/pull-requests" /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '도움말' }))
    await userEvent.click(screen.getByRole('menuitem', { name: /이 화면 둘러보기/ }))
    expect(start).toHaveBeenCalledWith('/pull-requests')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('둘러보기가 없는 화면에서는 준비 중으로 비활성화한다', async () => {
    render(<MemoryRouter><HelpMenu pathname="/deployments" /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '도움말' }))
    expect(screen.getByRole('menuitem', { name: /이 화면 둘러보기/ })).toBeDisabled()
    expect(screen.getByText('이 화면은 준비 중이에요')).toBeInTheDocument()
  })

  it('개인정보처리방침은 현재 작업을 유지하며 새 탭으로 연다', async () => {
    render(<MemoryRouter><HelpMenu pathname="/issues" /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '도움말' }))
    const link = screen.getByRole('menuitem', { name: /개인정보처리방침/ })
    expect(link).toHaveAttribute('href', '/privacy')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('도움말 보기는 매뉴얼을 새 탭으로 연다', async () => {
    render(<MemoryRouter><HelpMenu pathname="/issues" /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: '도움말' }))
    const link = screen.getByRole('menuitem', { name: /도움말 보기/ })
    expect(link).toHaveAttribute('href', tours.HELP_URL)
    expect(link).toHaveAttribute('target', '_blank')
  })
})
