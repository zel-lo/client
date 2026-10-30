import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith('/api/me')) return new Response(null, { status: 401 })
    if (String(input).endsWith('/api/auth/status')) return Response.json({ githubLoginEnabled: false })
    return new Response(null, { status: 404 })
  }))
  localStorage.clear()
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
  vi.stubGlobal('scrollTo', vi.fn())
  window.scrollTo = vi.fn()
})
afterEach(() => cleanup())
