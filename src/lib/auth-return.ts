const key = 'zello.auth.returnTo'
const lifetime = 15 * 60 * 1000
export function invitationReturnPath(value: string | null): string | null {
  return value && /^\/invite\/[A-Za-z0-9_-]{43}$/.test(value) ? value : null
}
export function rememberInvitation(path: string) {
  const safe = invitationReturnPath(path)
  if (!safe) return
  try { sessionStorage.setItem(key, JSON.stringify({ path: safe, createdAt: Date.now() })) } catch { throw new Error('초대로 돌아오려면 이 탭의 저장 공간을 사용할 수 있어야 해요. 로그인 후 초대 링크를 다시 열어주세요.') }
}
export function pendingInvitation(consume = false): string | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const saved = JSON.parse(raw) as { path?: string; createdAt?: number }
    const age = Date.now() - (saved.createdAt ?? 0)
    const safe = typeof saved.path === 'string' && age >= 0 && age < lifetime ? invitationReturnPath(saved.path) : null
    if (consume || !safe) sessionStorage.removeItem(key)
    return safe
  } catch { try { sessionStorage.removeItem(key) } catch { /* Storage is unavailable. */ }; return null }
}
