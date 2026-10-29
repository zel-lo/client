export type Repo = {
  id: string; name: string; description: string; language: string; color: string;
  branch: string; updated: string; build: 'success' | 'failed' | 'unknown'; deployment: string;
}
export type Activity = {
  id: number; type: 'merge' | 'commit' | 'pr' | 'issue' | 'deploy'; repo: string;
  title: string; summary: string; author: string; date: string; time: string;
  ref: string; branch: string; commits: number; files: number; additions: number; deletions: number;
  noteType?: 'feature' | 'fix' | 'improve'; deployed?: boolean;
}
export type PatchNote = {
  id: string; title: string; subtitle: string; date: string; version: string;
  status: 'published' | 'draft'; activityIds: number[]; summary: string;
}
export const members = [
  { name: '김서연', initials: '서연', role: 'Frontend', color: '#e2e9df' },
  { name: '박지훈', initials: '지훈', role: 'Backend', color: '#e8e2d7' },
  { name: '이수빈', initials: '수빈', role: 'Product', color: '#e4dfe9' },
  { name: '최민준', initials: '민준', role: 'Frontend', color: '#dfe8e9' },
]
export const initialRepos: Repo[] = [
  { id: 'web', name: 'moa-web', description: '모아 서비스 웹 클라이언트', language: 'TypeScript', color: '#5d8ba8', branch: 'main', updated: '14:32', build: 'success', deployment: 'Production' },
  { id: 'api', name: 'moa-api', description: '컬렉션 관리 및 공유 API 서버', language: 'Java', color: '#c68b58', branch: 'main', updated: '13:48', build: 'success', deployment: 'Production' },
  { id: 'design', name: 'moa-design', description: '공통 UI 컴포넌트 라이브러리', language: 'TypeScript', color: '#5d8ba8', branch: 'main', updated: '11:20', build: 'failed', deployment: '배포 대기' },
]
export const activities: Activity[] = [
  { id: 128, type: 'merge', repo: 'web', title: '컬렉션을 링크 하나로 공유할 수 있어요', summary: '내가 모은 컬렉션을 링크로 공유할 수 있습니다. 링크를 받은 사람은 로그인하지 않아도 컬렉션을 둘러볼 수 있어요.', author: '김서연', date: '2026-10-27', time: '14:32', ref: '#128', branch: 'feat/collection-share', commits: 6, files: 12, additions: 284, deletions: 48, noteType: 'feature', deployed: true },
  { id: 127, type: 'pr', repo: 'api', title: '검색 결과를 더 빠르게 불러오는 작업', summary: '컬렉션 검색 응답을 개선하는 작업을 마치고 코드 검토를 기다리고 있어요. 아직 기본 브랜치에는 반영되지 않았습니다.', author: '박지훈', date: '2026-10-27', time: '13:48', ref: '#87', branch: 'perf/search-query', commits: 4, files: 8, additions: 136, deletions: 74 },
  { id: 126, type: 'commit', repo: 'design', title: '버튼과 입력창의 간격을 다듬었어요', summary: '좁은 화면에서도 버튼을 누르기 쉽도록 터치 영역과 입력창의 여백을 조정했어요.', author: '최민준', date: '2026-10-27', time: '11:20', ref: 'a83f2c1', branch: 'fix/input-spacing', commits: 3, files: 5, additions: 42, deletions: 28 },
  { id: 125, type: 'deploy', repo: 'web', title: '새로운 모아가 서비스에 반영됐어요', summary: '컬렉션 링크 공유와 모바일 화면 개선이 실제 서비스에 배포됐어요. 지금부터 새로운 기능을 사용할 수 있습니다.', author: '김서연', date: '2026-10-27', time: '14:40', ref: 'v0.8.2', branch: 'main', commits: 0, files: 0, additions: 0, deletions: 0, deployed: true },
  { id: 124, type: 'issue', repo: 'web', title: '다음으로, 컬렉션을 함께 편집해요', summary: '팀원이 같은 컬렉션에 자료를 추가하고 정리할 수 있는 공동 편집 기능을 기획하고 있어요.', author: '이수빈', date: '2026-10-26', time: '17:05', ref: '#132', branch: '기획 중', commits: 0, files: 0, additions: 0, deletions: 0 },
  { id: 123, type: 'merge', repo: 'api', title: '저장한 링크가 사라지는 문제를 고쳤어요', summary: '같은 링크를 여러 번 저장했을 때 기존 항목이 보이지 않던 문제를 수정했습니다. 저장한 자료를 안정적으로 확인할 수 있어요.', author: '박지훈', date: '2026-10-26', time: '15:26', ref: '#85', branch: 'fix/duplicate-link', commits: 5, files: 6, additions: 98, deletions: 32, noteType: 'fix', deployed: true },
  { id: 122, type: 'merge', repo: 'web', title: '모바일에서도 컬렉션을 편하게 둘러봐요', summary: '모바일 컬렉션 목록의 카드 간격과 썸네일 크기를 조정했어요. 작은 화면에서도 더 많은 자료를 편하게 확인할 수 있습니다.', author: '최민준', date: '2026-10-25', time: '16:18', ref: '#125', branch: 'improve/mobile-collection', commits: 4, files: 7, additions: 115, deletions: 62, noteType: 'improve', deployed: true },
  { id: 121, type: 'pr', repo: 'design', title: '키보드로도 메뉴를 이동할 수 있도록', summary: '마우스 없이도 메뉴와 대화상자를 이용할 수 있도록 키보드 이동과 포커스 표시를 개선하는 중입니다.', author: '최민준', date: '2026-10-24', time: '18:03', ref: '#32', branch: 'feat/keyboard-navigation', commits: 3, files: 4, additions: 87, deletions: 21 },
  { id: 120, type: 'merge', repo: 'api', title: '이미지 업로드 실패 시 안내를 추가했어요', summary: '이미지 용량이 너무 크거나 네트워크 연결이 끊겼을 때 이유와 재시도 방법을 안내합니다.', author: '박지훈', date: '2026-10-23', time: '14:10', ref: '#84', branch: 'fix/upload-error', commits: 4, files: 5, additions: 72, deletions: 16, noteType: 'fix', deployed: false },
  { id: 119, type: 'commit', repo: 'web', title: '공유 페이지의 미리보기 이미지를 정리했어요', summary: '공유 링크를 메신저에 붙여넣었을 때 컬렉션 제목과 대표 이미지가 표시되도록 준비했습니다.', author: '김서연', date: '2026-10-22', time: '16:42', ref: 'd29e4a8', branch: 'feat/collection-share', commits: 5, files: 4, additions: 63, deletions: 11 },
  { id: 118, type: 'merge', repo: 'design', title: '텍스트의 명도 대비를 개선했어요', summary: '밝은 배경의 보조 설명과 버튼 글자를 더 선명하게 조정했습니다.', author: '최민준', date: '2026-10-21', time: '10:15', ref: '#29', branch: 'improve/contrast', commits: 5, files: 3, additions: 34, deletions: 27, noteType: 'improve', deployed: true },
  { id: 117, type: 'merge', repo: 'web', title: '컬렉션을 나만의 순서로 정리해요', summary: '끌어서 놓는 방식으로 컬렉션의 순서를 바꿀 수 있어요. 중요한 자료를 앞쪽에 배치해 보세요.', author: '김서연', date: '2026-10-20', time: '15:42', ref: '#119', branch: 'feat/collection-order', commits: 7, files: 8, additions: 203, deletions: 43, noteType: 'feature', deployed: true },
  { id: 116, type: 'merge', repo: 'api', title: '로그인이 만료되면 다시 안내해 드려요', summary: '로그인이 만료된 상태에서 자료를 저장할 때 재로그인 안내가 표시되도록 수정했습니다.', author: '박지훈', date: '2026-10-19', time: '12:28', ref: '#80', branch: 'fix/token-expiration', commits: 3, files: 4, additions: 74, deletions: 22, noteType: 'fix', deployed: true },
  { id: 115, type: 'commit', repo: 'design', title: '새로운 아이콘을 공통 컴포넌트로 정리했어요', summary: '저장, 공유, 컬렉션 메뉴에서 같은 아이콘을 사용할 수 있도록 정리했습니다.', author: '최민준', date: '2026-10-18', time: '16:03', ref: 'b26d7a1', branch: 'main', commits: 4, files: 12, additions: 98, deletions: 102 },
  { id: 114, type: 'pr', repo: 'web', title: '비어 있는 컬렉션에 안내를 추가해요', summary: '자료가 없는 컬렉션에서 첫 링크를 저장하는 방법을 안내하는 화면입니다.', author: '김서연', date: '2026-10-17', time: '11:54', ref: '#118', branch: 'feat/empty-state', commits: 2, files: 3, additions: 65, deletions: 14 },
  { id: 113, type: 'merge', repo: 'web', title: '저장할 때 컬렉션을 바로 선택해요', summary: '링크를 저장하는 화면에서 컬렉션을 바로 선택할 수 있어요. 저장한 뒤 다시 정리하는 수고를 줄였습니다.', author: '김서연', date: '2026-10-15', time: '13:11', ref: '#112', branch: 'feat/quick-save', commits: 5, files: 6, additions: 147, deletions: 31, noteType: 'feature', deployed: true },
  { id: 112, type: 'merge', repo: 'api', title: '이미지가 없는 링크도 깔끔하게 보여요', summary: '대표 이미지가 없는 링크에는 사이트 이름과 기본 이미지를 표시합니다.', author: '박지훈', date: '2026-10-12', time: '17:19', ref: '#75', branch: 'fix/link-thumbnail', commits: 3, files: 4, additions: 56, deletions: 18, noteType: 'fix', deployed: true },
]
export const initialNotes: PatchNote[] = [
  { id: 'week-43', title: '컬렉션 공유 및 모바일 UI 개선', subtitle: '10월 넷째 주 업데이트', date: '2026-10-27', version: 'v0.8.2', status: 'published', activityIds: [128, 123, 122], summary: '컬렉션 링크 공유 기능을 추가했습니다. 중복 링크 저장 오류를 수정하고 모바일 컬렉션 화면을 개선했습니다.' },
  { id: 'draft-44', title: '이미지 업로드 오류 안내 개선', subtitle: '배포 대기 중인 변경 사항', date: '2026-10-27', version: '다음 업데이트', status: 'draft', activityIds: [120], summary: '이미지를 업로드할 때 무엇이 잘못됐는지 더 명확하게 알려드려요. 서비스 배포를 기다리고 있습니다.' },
  { id: 'week-42', title: '컬렉션 정렬 및 로그인 처리 개선', subtitle: '10월 셋째 주 업데이트', date: '2026-10-20', version: 'v0.8.1', status: 'published', activityIds: [117, 116], summary: '중요한 컬렉션을 앞에 두고, 자료를 더 안정적으로 저장할 수 있도록 개선했어요.' },
  { id: 'week-41', title: '링크 저장 및 미리보기 개선', subtitle: '10월 둘째 주 업데이트', date: '2026-10-15', version: 'v0.8.0', status: 'published', activityIds: [113, 112], summary: '저장 화면에서 컬렉션을 선택할 수 있도록 변경하고, 이미지가 없는 링크의 기본 미리보기를 추가했습니다.' },
]
export const typeLabels = { merge: '반영 완료', commit: '코드 변경', pr: '검토 중', issue: '새로운 제안', deploy: '배포 완료' }
export const categoryLabels = { feature: '새로운 기능', fix: '오류 수정', improve: '사용성 개선' }
export const periods = {
  week: { label: '이번 주', range: '10.21 — 10.27', start: '2026-10-21' },
  previous: { label: '지난주', range: '10.14 — 10.20', start: '2026-10-14', end: '2026-10-20' },
  month: { label: '이번 달', range: '10.01 — 10.27', start: '2026-10-01' },
}
export type Period = keyof typeof periods
export function inPeriod(a: { date: string }, period: Period) {
  const p = periods[period]
  return a.date >= p.start && a.date <= ('end' in p ? p.end : '2026-10-27')
}
export function dateLabel(date: string) {
  return date === '2026-10-27' ? '오늘' : date === '2026-10-26' ? '어제' : `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일`
}
export const sortedActivities = [...activities].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
