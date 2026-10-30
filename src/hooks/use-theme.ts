import { useEffect, useState } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try { return JSON.parse(localStorage.getItem('gyeol.theme.v2') ?? '"light"') === 'dark' ? 'dark' : 'light' } catch { return 'light' }
  })
  useEffect(() => {
    try { localStorage.setItem('gyeol.theme.v2', JSON.stringify(theme)) } catch { /* Private browsing may restrict storage. */ }
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', `/brand/zello-logo-${theme}.svg`)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#12151F' : '#F2F4F7')
  }, [theme])
  return [theme, setTheme] as const
}
