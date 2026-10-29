import { CURRENT_USER } from './work-items'

export type InboxTarget = { type: 'issue'; id: string } | { type: 'pr'; id: string } | { type: 'activity'; id: number }
export type InboxItem = {
  id: string; recipient: string; title: string; body: string; repo: string;
  kind: 'review' | 'meeting' | 'deployment'; createdAt: string; readAt: string | null; target: InboxTarget;
}
export const initialInbox: InboxItem[] = [
  { id: 'review-api-87', recipient: CURRENT_USER, title: '검색 응답 개선 PR의 검토를 요청받았어요', body: '박지훈 님이 이수빈 님에게 코드 검토를 요청했습니다. 연결된 이슈와 변경 요약을 확인해 주세요.', repo: 'api', kind: 'review', createdAt: '2026-10-27T13:48:00+09:00', readAt: null, target: { type: 'pr', id: 'api-87' } },
  { id: 'meeting-web-132', recipient: CURRENT_USER, title: '주간 회의에서 다음 작업이 등록됐어요', body: '컬렉션 공동 편집 작업이 등록됐습니다. 작업 설명, 완료 조건과 담당자를 확인해 주세요.', repo: 'web', kind: 'meeting', createdAt: '2026-10-26T17:05:00+09:00', readAt: null, target: { type: 'issue', id: 'MOA-44' } },
  { id: 'deployment-web-082', recipient: CURRENT_USER, title: '모아 웹 업데이트가 서비스에 반영됐어요', body: '컬렉션 링크 공유와 모바일 화면 개선이 배포됐습니다.', repo: 'web', kind: 'deployment', createdAt: '2026-10-27T14:40:00+09:00', readAt: '2026-10-27T14:45:00+09:00', target: { type: 'activity', id: 125 } },
]
export function createInitialInbox() {
  try {
    // Preserve the old demo's explicit "mark all read" action when migrating.
    if (localStorage.getItem('gyeol.notifications.v1') === 'true') return initialInbox.map(item => ({ ...item, readAt: item.readAt ?? '2026-10-27T14:45:00+09:00' }))
  } catch { /* The demo can also run without storage. */ }
  return initialInbox
}
