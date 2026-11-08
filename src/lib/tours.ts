import { driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'

// 도움말(매뉴얼) 주소. 비어 있으면 준비 중으로 표시한다
export const HELP_URL = ''

type TourStep = { target: string; title: string; description: string }

const tour = (name: string) => `[data-tour="${name}"]`
const repoScope: TourStep = { target: tour('repo-scope'), title: '저장소 선택', description: '연결한 저장소 중 하나만 골라 그 저장소의 내용만 볼 수 있어요.' }
const myWork = 'section[aria-label="내 작업 목록"]'

// 화면별 둘러보기 단계. target은 CSS 선택자이며, 화면에 없는 요소는 건너뛴다
const tours: Record<string, TourStep[]> = {
  '/inbox': [
    { target: '.inbox-panel .segmented-tabs', title: '미확인 · 전체', description: '아직 확인하지 않은 알림만 보거나, 지난 알림까지 모두 볼 수 있어요.' },
    { target: '.inbox-panel .content-filter > .button', title: '모두 읽음', description: '미확인 알림을 한 번에 읽음으로 표시해요.' },
    { target: '.inbox-item', title: '알림', description: '알림을 누르면 관련 작업이나 PR로 이동해요. 오른쪽에서 읽음 상태를 바꿀 수 있어요.' },
  ],
  '/my-work': [
    repoScope,
    { target: `${myWork} > .content-filter .segmented-tabs`, title: '내 작업 탭', description: '내가 맡은 작업, 내게 온 검토 요청, 내가 올린 PR을 나눠서 볼 수 있어요.' },
    { target: '.my-work-tools .button', title: 'GitHub PR 가져오기', description: 'GitHub에서 새로 올라온 PR과 리뷰 상태를 가져와요.' },
    { target: `${myWork} .board-toolbar`, title: '검색과 필터', description: '제목이나 작업 번호로 찾고, 진행 상태로 좁혀 볼 수 있어요.' },
    { target: `${myWork} .board-card, ${myWork} [data-slot="table-body"] [data-slot="table-row"]`, title: '항목 열기', description: '작업을 누르면 가운데에 작업 상세가, PR을 누르면 오른쪽에 PR 상세가 열려요.' },
  ],
  '/overview': [
    { target: '.metrics-strip', title: '확인 현황', description: '담당자 미지정, 이슈 미연결, 검토 중, 병합된 수를 한눈에 봐요. 누르면 해당 목록으로 이동해요.' },
    { target: '.team-summary', title: '확인이 필요한 작업', description: '담당자가 없거나 다음 확인이 필요한 작업을 먼저 모았어요.' },
    { target: '.weekly-section', title: '최신 팀 업데이트', description: '가장 최근에 공개한 패치노트를 보여줘요.' },
    { target: '.development-chart', title: '개발 활동', description: '기간별 커밋, PR, 병합 흐름을 볼 수 있어요.' },
    { target: '.activity-table-section', title: '최근 개발 기록', description: '최근 변경을 시간순으로 보고, 눌러서 자세히 볼 수 있어요.' },
  ],
  '/issues': [
    repoScope,
    { target: '#workspace-page-actions .button-dark', title: '새 작업 등록', description: '회의에서 정한 일을 등록해요. zello에 저장하고 GitHub 이슈로도 만들 수 있어요.' },
    { target: '#workspace-page-actions .issue-actions .button:not(.button-dark)', title: 'GitHub 이슈 가져오기', description: 'GitHub에서 바뀐 이슈 내용을 가져와요.' },
    { target: '.week-navigation', title: '주차 이동', description: '프로젝트 주차별로 계획한 작업을 볼 수 있어요. 끝내지 못한 작업은 다음 주에도 이어서 보여요.' },
    { target: '.work-view-toggle', title: '보드 · 목록', description: '단계별 보드나 한 줄씩 보는 목록으로 바꿀 수 있어요.' },
    { target: '.board-toolbar .board-search', title: '검색과 필터', description: '제목이나 작업 번호로 찾고, 상태와 담당자로 좁혀 볼 수 있어요.' },
    { target: '.board-display-actions', title: '백로그 · 회의 모드', description: '백로그를 함께 펼쳐 보거나, 회의 모드로 먼저 확인할 작업만 모아 볼 수 있어요.' },
    { target: '.board-columns', title: '단계 옮기기', description: '카드를 끌어 단계를 바꿔요. 진행 중으로 옮기면 작업 브랜치를, 검토 중으로 옮기면 PR 연결을 안내해요.' },
    { target: '.board-card', title: '작업 카드', description: '누르면 상세가 열려요. GitHub 번호가 보이면 GitHub에 발행된 작업이고, zello 로고는 zello에만 있는 작업이에요.' },
  ],
  '/pull-requests': [
    repoScope,
    { target: tour('pr-sync'), title: 'GitHub PR 가져오기', description: 'GitHub에서 새로 올라온 PR과 리뷰 상태를 가져와요. 목록이 최신이 아닐 때 눌러 주세요.' },
    { target: tour('pr-create'), title: 'PR 작성', description: '저장소와 브랜치를 고르고, 해결할 이슈를 연결해 GitHub에 PR을 만들어요.' },
    { target: tour('pr-tabs'), title: '상태 탭', description: '열린 PR, 병합된 PR, 전체를 나눠서 볼 수 있어요. 숫자는 탭별 PR 개수예요.' },
    { target: tour('pr-filter'), title: '검토 상태 필터', description: '검토를 기다리는 PR, 수정 요청을 받은 PR, 이슈가 연결되지 않은 PR만 골라 볼 수 있어요.' },
    { target: tour('pr-row'), title: 'PR 상세', description: 'PR을 누르면 오른쪽에 상세가 열려요. 팀 요약 작성, 리뷰 제출, 이슈 연결, 병합을 여기서 할 수 있어요.' },
  ],
  '/changes': [
    { target: 'nav[aria-label="변경 소식 메뉴"]', title: '팀 업데이트 · 개발 기록', description: '팀 업데이트에서는 패치노트로 결과를 공유하고, 개발 기록에서는 변경 과정을 시간순으로 봐요.' },
    { target: '#workspace-page-actions .button-dark', title: '패치노트 작성', description: '반영된 PR을 골라 팀에 공유할 패치노트를 써요.' },
    { target: '.timeline-page .segmented-tabs', title: '기록 종류', description: '반영 완료, 검토 중, 코드 변경 등 종류별로 골라 볼 수 있어요.' },
  ],
  '/settings': [
    { target: 'a[href="/settings?tab=general"]', title: '일반', description: '프로젝트 이름과 설명을 수정하고, 프로젝트 기간을 확인해요.' },
    { target: 'a[href="/settings?tab=members"]', title: '멤버', description: '팀원을 초대하고 역할을 정해요.' },
    { target: 'a[href="/settings?tab=repositories"]', title: '저장소 연결', description: '프로젝트에 GitHub 저장소를 연결하거나 해제해요.' },
    { target: 'a[href="/settings?tab=sync"]', title: '동기화', description: '연결한 저장소별로 데이터 수집 상태를 확인해요.' },
  ],
}

export function hasTour(pathname: string) {
  return Boolean(tours[pathname])
}

/** 현재 화면에 보이는 요소만 골라 둘러보기를 시작한다. */
export function startTour(pathname: string) {
  const steps: DriveStep[] = (tours[pathname] ?? [])
    .map(step => ({ step, element: document.querySelector<HTMLElement>(step.target) }))
    .filter(({ element }) => element && element.offsetParent !== null)
    .map(({ step, element }) => ({ element: element!, popover: { title: step.title, description: step.description } }))
  if (!steps.length) return false
  driver({
    steps, showProgress: true, allowClose: true, popoverClass: 'zello-tour', stagePadding: 6, stageRadius: 10,
    progressText: '{{current}} / {{total}}', nextBtnText: '다음', prevBtnText: '이전', doneBtnText: '완료',
  }).drive()
  return true
}
