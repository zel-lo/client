# zello 컴포넌트 스타일

2026-11-01. 현재 브랜드 팔레트와 Pretendard를 유지하면서 버튼, 입력, 카드, 탭의 크기·간격·상태를 통일한다. TDS의 [Button](https://tossmini-docs.toss.im/tds-mobile/components/button/)과 [TextField](https://tossmini-docs.toss.im/tds-mobile/components/TextField/text-field/) 가이드를 참고했다.

| 요소 | 기본 규칙 |
| --- | --- |
| 주요 버튼 | 기존 브랜드 파랑, 높이 44px, 반경 12px, 600 굵기 |
| 큰 CTA | 높이 52~54px, 반경 14px |
| 보조 버튼 | 옅은 중립 표면, 테두리·그림자를 줄여 주요 행동과 위계 구분 |
| 입력·선택 | 높이 48px, 반경 12px, 옅은 채움, 포커스 시 파랑 테두리와 halo |
| 필터 | 높이 40~44px, 입력 폼보다 조밀한 크기 |
| 카드 | 반경 20px, 옅은 테두리, 넉넉한 내부 간격 |
| 대화상자 | 반경 24px, 제목과 필드 간격, 기존 스크롤·포커스 처리 유지 |
| 탭 | 옅은 트랙 위에 흰색/다크 카드 표면으로 선택 상태 표시 |
| 피드백 | hover/pressed/focus/disabled/error, reduced-motion에서 눌림 확대·축소 제거 |

`src/styles.css`의 `--control-height`, `--control-radius`, `--panel-radius`, `--control-bg`, `--control-hover-bg`, `--quiet-line`, `--focus-halo`를 공유한다. `:root.dark`에서도 기존 의미별 색상으로 계산된다. 브랜드 파랑·코랄·배경 HEX는 그대로다.

HTML `.button`과 `components/ui/Button`은 같은 주요/보조 위계를 사용한다. `components/ui/Input`, `Card`, `Sheet`와 실제 이슈·저장소·멤버 화면의 폼도 같은 규칙을 따른다. 공개 화면의 로그인 CTA와 초대 화면에도 적용한다. 키보드 포커스·오류 대비와 기존 기능은 유지하며 데이터 수집이나 자동 갱신 동작은 변경하지 않는다.

검증: 기존 프런트엔드 102개 테스트, TypeScript/Vite 빌드, 브라우저에서 라이트·다크 대시보드와 이슈 작성 폼을 확인한다.
