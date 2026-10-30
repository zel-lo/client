import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../src/App'
import { githubAuthUrl } from '../src/lib/auth'

vi.mock('../src/components/ui/contribution-skyline', () => ({ default: () => <div />, generateContributions: () => [] }))

function mount(route = '/') {
  return render(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)
}

describe('메인과 GitHub 로그인 흐름', () => {
  it('메인에서 회원가입으로 이동하고 로그인 화면으로 전환한다', async () => {
    const user = userEvent.setup()
    mount()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Git에 익숙하지 않아도괜찮아요.')
    await user.click(screen.getByRole('link', { name: /GitHub로 시작하기/ }))
    expect(screen.getByRole('heading', { name: 'zello 시작하기' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getAllByRole('link', { name: '로그인', exact: true })[0])
    expect(screen.getByRole('heading', { name: 'zello에 로그인' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'GitHub로 로그인' })).toBeInTheDocument()
  })

  it('연결 전에는 계정 생성 없이 안내하고 기존 대시보드 미리보기를 연다', async () => {
    const user = userEvent.setup()
    mount('/signup')
    await user.click(screen.getByRole('button', { name: 'GitHub로 시작하기' }))
    expect(screen.getByRole('status')).toHaveTextContent('GitHub 로그인을 준비하고 있어요.')
    expect(localStorage.getItem('gyeol.issues.v1')).toBeNull()
    await user.click(screen.getByRole('link', { name: '샘플 프로젝트 둘러보기' }))
    expect(screen.getByRole('heading', { name: /^전체 현황/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^전체 현황/ })).toHaveAttribute('aria-current', 'page')
    await user.click(screen.getByRole('link', { name: 'zello 홈' }))
    expect(screen.getByRole('link', { name: /GitHub로 시작하기/ })).toBeInTheDocument()
  })

  it.each([
    ['access_denied', '취소됐어요'], ['expired', '만료됐어요'], ['failed', '실패했어요'],
  ])('OAuth 오류 %s를 안내하고 재시도 버튼을 제공한다', (error, message) => {
    mount(`/login?error=${error}`)
    expect(screen.getByRole('status')).toHaveTextContent(message)
    expect(screen.getByRole('button', { name: 'GitHub로 로그인' })).toBeEnabled()
  })

  it('본문 바로가기는 해시 라우트를 바꾸지 않고 본문에 초점을 맞춘다', async () => {
    const user = userEvent.setup()
    mount('/signup')
    await user.click(screen.getByRole('link', { name: '본문으로 이동' }))
    expect(document.getElementById('public-main')).toHaveFocus()
    expect(screen.getByRole('heading', { name: 'zello 시작하기' })).toBeInTheDocument()
  })

  it('로그인과 회원가입 사이에 선택한 테마를 유지한다', async () => {
    const user = userEvent.setup()
    mount('/login')
    await user.click(screen.getByRole('button', { name: '어두운 테마로 전환' }))
    await user.click(screen.getAllByRole('link', { name: '회원가입', exact: true })[0])
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('button', { name: '밝은 테마로 전환' })).toBeInTheDocument()
  })
})

describe('OAuth 시작 주소', () => {
  it('HTTPS와 로컬 개발 서버를 허용한다', () => {
    expect(githubAuthUrl('https://api.example.com/oauth2/authorization/github')).toBe('https://api.example.com/oauth2/authorization/github')
    expect(githubAuthUrl('http://localhost:8080/oauth2/authorization/github')).toBe('http://localhost:8080/oauth2/authorization/github')
  })
  it.each([undefined, '', '/missing', 'javascript:alert(1)', 'http://api.example.com/login', 'https://secret@example.com/login'])('잘못된 주소 %s로 이동하지 않는다', value => {
    expect(githubAuthUrl(value)).toBeNull()
  })
})
