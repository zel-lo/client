import { githubAuthUrl } from './auth'

export type CurrentUser = {
  id: string
  githubId: string
  login: string
  displayName: string
  avatarUrl: string | null
  email: string | null
  theme: string
}

async function request(path: string, options: RequestInit = {}) {
  try {
    return await fetch(path, { credentials: 'include', cache: 'no-store', ...options })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new Error('서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }
}

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser | null> {
  const response = await request('/api/me', { signal })
  if (response.status === 401) return null
  if (!response.ok) throw new Error('로그인 상태를 확인하지 못했어요. 다시 시도해 주세요.')
  return response.json() as Promise<CurrentUser>
}

export async function beginGitHubLogin(
  configuredUrl: string | undefined,
  redirect: (url: string) => void = url => window.location.assign(url),
) {
  const response = await request('/api/auth/status')
  if (!response.ok) throw new Error('로그인 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.')
  const status = await response.json() as { githubLoginEnabled: boolean }
  if (!status.githubLoginEnabled) {
    throw new Error('GitHub 로그인을 준비하고 있어요. 샘플 프로젝트는 바로 둘러볼 수 있어요.')
  }
  const configured = githubAuthUrl(configuredUrl)
  if (configuredUrl?.trim() && !configured) throw new Error('로그인 연결 주소를 확인해 주세요.')
  redirect(configured ?? new URL('/oauth2/authorization/github', window.location.origin).href)
}

export async function endSession() {
  const csrfResponse = await request('/api/auth/csrf')
  if (!csrfResponse.ok) throw new Error('로그아웃을 준비하지 못했어요. 다시 시도해 주세요.')
  const csrf = await csrfResponse.json() as { headerName: string; token: string }
  const response = await request('/api/auth/logout', { method: 'POST', headers: { [csrf.headerName]: csrf.token } })
  if (!response.ok) throw new Error('로그아웃하지 못했어요. 다시 시도해 주세요.')
}
