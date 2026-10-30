import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { endSession, getCurrentUser } from '../lib/session-api'
import type { CurrentUser } from '../lib/session-api'

type Session = {
  user: CurrentUser | null
  status: 'loading' | 'ready' | 'unavailable'
  error: string
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<Session['status']>('loading')
  const [error, setError] = useState('')
  const controller = useRef<AbortController | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)

  const refresh = useCallback(async () => {
    controller.current?.abort()
    const pending = new AbortController()
    controller.current = pending
    setStatus('loading')
    setError('')
    try {
      const current = await getCurrentUser(pending.signal)
      if (!pending.signal.aborted) {
        setUser(current)
        setStatus('ready')
      }
    } catch (cause) {
      if (!pending.signal.aborted) {
        setUser(null)
        setStatus('unavailable')
        setError(cause instanceof Error ? cause.message : '로그인 상태를 확인하지 못했어요.')
      }
    }
  }, [])

  useEffect(() => {
    void refresh()
    return () => controller.current?.abort()
  }, [refresh])

  useEffect(() => {
    const check = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('zello-session')
      channel.current.onmessage = () => { void refresh() }
    }
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
      channel.current?.close()
      channel.current = null
    }
  }, [refresh])

  const logout = useCallback(async () => {
    await endSession()
    controller.current?.abort()
    setUser(null)
    setStatus('ready')
    setError('')
    channel.current?.postMessage('signed-out')
  }, [])

  return <SessionContext.Provider value={{ user, status, error, refresh, logout }}>{children}</SessionContext.Provider>
}

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('SessionProvider is required')
  return session
}
