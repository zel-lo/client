# 클라이언트 CI와 컨테이너 이미지 배포

설정: [Client CI/CD](.github/workflows/ci-cd.yml)

## 실행 조건과 결과

- `main` 대상 PR: Node.js 24에서 `npm ci`, 전체 테스트, TypeScript/Vite 빌드를 수행하고 Docker 이미지를 검증합니다.
- `main` push: 위 검증 후 `ghcr.io/zel-lo/client:sha-<전체 커밋 SHA>` 이미지를 업로드합니다.
- GitHub Actions의 `Run workflow`로 수동 실행할 수 있습니다. 이미지 업로드는 `main` 실행에만 적용됩니다.
- 테스트 보고서와 `dist`는 실행의 Artifacts에 7일간 보관합니다.

컨테이너 검증에는 정적 페이지, 없는 정적 파일의 404 응답, 에셋 캐시, API/OAuth 프록시 경로와 HTTPS 전달이 포함됩니다. 이미지는 일반 사용자로 실행하며, `/healthz`를 상태 확인에 사용합니다.

## GitHub 반영

이 설정을 `main`에 push하면 자동 실행됩니다. 저장소에서 GitHub Actions 사용과 `GITHUB_TOKEN`의 `packages: write` 권한이 허용되어 있어야 합니다. 별도 PAT나 Docker Hub 비밀값은 필요하지 않습니다.

실행 결과: https://github.com/zel-lo/client/actions

## 로컬 검증

```sh
npm ci
npm test
npm run build
docker build -t zello-client:local .
bash scripts/smoke-container.sh zello-client:local
```

## 운영 배포 범위

`DEPLOY_ENABLED=true`이고 배포용 Secrets가 등록되면 이미지 업로드 후 `zello.asia`에 자동 배포합니다. 설정 전에는 운영 배포 작업을 건너뜁니다. 서버의 운영 `.env`, SSH 키와 GitHub Actions 설정은 [서버 PRODUCTION.md](https://github.com/zel-lo/server/blob/main/PRODUCTION.md)를 참고하세요.

컨테이너는 8080 포트에서 실행하며 `API_UPSTREAM`의 기본값은 `http://server:8080`입니다. 운영 환경에서는 백엔드 주소와 HTTPS 프록시를 설정하고, 백엔드의 OAuth callback·프론트 주소·보안 세션 쿠키를 같은 서비스 도메인에 맞춰야 합니다.
