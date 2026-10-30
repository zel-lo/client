// The server owns the OAuth state, code exchange and session cookie.
export function githubAuthUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if (url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))) return null
    return url.href
  } catch { return null }
}
