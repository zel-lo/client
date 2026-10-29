# Zello Client

회의에서 정한 작업, 담당자, PR과 변경 사항을 여러 GitHub 저장소에 걸쳐 확인하는 React 클라이언트입니다.
현재는 가상의 모아 프로젝트 데이터를 사용하는 프론트엔드 프로토타입입니다.

## 실행

```sh
npm ci
npm run dev
```

기본 개발 주소: http://127.0.0.1:5173
화면 이동에는 해시 라우팅을 사용합니다. 예: `http://127.0.0.1:5173/#/inbox`.

## 검증 및 빌드

```sh
npm test
npm run build
npm run preview
```

정적 빌드 결과는 `dist/`에 생성됩니다.

## 주요 화면

- 개인: 알림함, 내 작업(담당 이슈·검토 요청·내 PR)
- 팀: 전체 현황, 팀 작업, 코드 검토, 변경 소식(팀 업데이트·개발 기록)
- 관리: 빌드와 배포, 프로젝트 설정(일반·멤버·저장소 연결·동기화)

이슈·PR 작성 및 연결, 회의 정보, 알림 읽음 상태, 저장소 추가, 패치노트 편집과 설정은 브라우저의 localStorage에 저장됩니다.
GitHub OAuth, 실제 GitHub 이슈·PR 생성, 서버 동기화, 알림 발송 및 실제 배포는 아직 연결되지 않았습니다.
샘플 활동 기준일은 2026년 10월 27일이며 잔디 활동량은 별도로 생성한 시각화 데이터입니다.

## 기술 구성

React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, React Router, Vitest 및 React Testing Library를 사용합니다.
가져온 shadcn/ui 컴포넌트의 MIT 라이선스는 [SHADCN-LICENSE.md](SHADCN-LICENSE.md)에 보존했습니다.

`docs/`는 로컬 기획 자료로 사용하며 Git 추적 대상에서 제외합니다.
