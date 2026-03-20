# SSO Integration Guide

이 문서는 `backend/sso` 모듈을 다른 앱에 적용할 때 사용하는 가이드라인입니다.  
현재 구현은 **Keycloak OIDC Authorization Code + Django SessionAuthentication** 조합을 기준으로 합니다.

## 1. 아키텍처 요약

- 로그인 시작: `GET /api/sso/login/`
- 콜백 처리: `GET /api/sso/callback/`
- 세션 확인: `GET /api/sso/session/`
- 로그아웃: `GET /api/sso/logout/`

흐름:

1. 프론트가 `/api/sso/login/?next=...` 호출
2. 백엔드가 `state/nonce`를 세션에 저장 후 Keycloak으로 리다이렉트
3. callback에서 code 교환 -> `id_token/access_token` 검증
4. 로컬 사용자 동기화 후 `django_login()`으로 세션 로그인
5. 프론트는 `/api/sso/session/`으로 인증 상태 확인

핵심 원칙:

- 프론트 localStorage 토큰이 아니라 **서버 세션**을 인증 기준으로 사용
- `next` URL은 allowlist 기반으로 검증

## 2. 코드 구성

- 라우팅: [urls.py](/home/pengejeen/p6ix-CPE/backend/sso/urls.py)
- 엔드포인트 구현: [views.py](/home/pengejeen/p6ix-CPE/backend/sso/views.py)
- 토큰 검증: [keycloak_auth.py](/home/pengejeen/p6ix-CPE/backend/sso/keycloak_auth.py)
- 사용자 동기화/next 검증: [services.py](/home/pengejeen/p6ix-CPE/backend/sso/services.py)

## 3. 필수 설정값

백엔드 `.env`:

- `KEYCLOAK_ENABLED=true`
- `KEYCLOAK_SERVER_URL`
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET` (confidential client일 때)
- `KEYCLOAK_REDIRECT_URI` (예: `https://api.example.com/api/sso/callback/`)
- `KEYCLOAK_SCOPE` (기본값: `openid profile email`)
- `KEYCLOAK_VERIFY_AUDIENCE=true`
- `SSO_NEW_USER_POLICY=auto|pending|deny`
- `SSO_DEFAULT_NEXT_URL`
- `SSO_FAILED_REDIRECT_URL`
- `SSO_ALLOWED_NEXT_ORIGINS` (콤마 리스트)

세션/CSRF 관련:

- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SAMESITE`
- `CSRF_COOKIE_SECURE`
- `CSRF_TRUSTED_ORIGINS`

프론트:

- `VITE_USE_SESSION_AUTH=true`
- `VITE_KEYCLOAK_ENABLED=true`
- `VITE_API_BASE=/api` (또는 실제 API base)
- 선택: `VITE_SSO_NEXT_PATH`
- 선택: `VITE_SSO_PROVIDER` (`kc_idp_hint`)

## 4. 타 앱 이식 절차

## 4.1 백엔드

1. 사용자 모델 필드 추가
- `keycloak_sub` (unique nullable)
- `login_provider` (기본 `local`)
- `role` (선택)

2. URL 연결
- 메인 URLConf에 `path("api/sso/", include("sso.urls", namespace="sso"))`

3. 인증 클래스 정리
- `SessionAuthentication` 활성화
- API 권한 정책(`IsAuthenticated`)과 예외 경로(`AllowAny`) 명확화

4. 사용자 동기화 정책 결정
- `auto`: 신규 사용자 자동 활성
- `pending`: 신규 생성 후 승인 대기
- `deny`: 등록된 사용자만 허용

5. 콜백 실패 처리 기준 합의
- `invalid_state`, `pending_approval`, `not_registered`, `callback_failed`에 대한 UX/로그 기준 확정

## 4.2 프론트

1. 로그인 버튼
- `/api/sso/login/?next=<앱 진입 경로>` 이동

2. 앱 진입 시 세션 확인
- `/api/sso/session/` 호출로 `authenticated` 및 `user` 상태 확인

3. 로그아웃
- `/api/sso/logout/?next=<로그인 페이지>`

4. HTTP 클라이언트
- `withCredentials: true`
- 세션 모드에서는 Bearer refresh 로직 분기/비활성

## 4.3 Keycloak

1. Realm 생성
2. Client 생성
- Redirect URI: `.../api/sso/callback/`
- Post logout redirect URI: 로그인 페이지
3. Claims 매퍼 확인
- `sub`, `email`, `preferred_username`, `name`, `given_name`, `family_name`
4. Role claim 확인
- `realm_access.roles` 또는 `resource_access.<client>.roles`

## 5. 보안 체크리스트

- `KEYCLOAK_VERIFY_AUDIENCE=true` 유지
- `next` 값은 내부 경로 또는 allowlist origin만 허용
- `SSO_ALLOWED_NEXT_ORIGINS` 최소 범위 운영
- 운영에서는 `SESSION_COOKIE_SECURE=true`, `CSRF_COOKIE_SECURE=true`
- 예외 로그에 access token/id token 원문 출력 금지

## 6. 장애 대응 포인트

- `invalid_state`: 세션 손실/도메인 쿠키 문제 가능성 우선 확인
- `callback_failed`: token endpoint 통신, cert/JWKS 접근, nonce mismatch 점검
- `pending_approval`: 사용자 승인 프로세스 또는 정책(`SSO_NEW_USER_POLICY`) 확인
- `not_registered`: `deny` 정책 및 사용자 사전 등록 여부 확인

## 7. 권장 도입 순서

1. 비운영 환경에서 세션 로그인 먼저 안정화
2. 기존 사용자와 `keycloak_sub`/email 매핑 검증
3. API 권한 회귀 테스트 적용
4. 운영 배포 후 레거시 로그인 점진 축소

---

추가 참고 문서:

- [SSO사용방법.md](/home/pengejeen/p6ix-CPE/SSO사용방법.md)

## 8. 최소 적용 템플릿

아래 템플릿은 "다른 앱에 붙여서 시작"하는 용도입니다.

## 8.1 `.env` 예시 (백엔드)

```env
# --- SSO / Keycloak ---
KEYCLOAK_ENABLED=true
KEYCLOAK_SERVER_URL=https://keycloak.example.com
KEYCLOAK_REALM=my-realm
KEYCLOAK_CLIENT_ID=my-client
KEYCLOAK_CLIENT_SECRET=__set_if_confidential_client__
KEYCLOAK_REDIRECT_URI=https://api.example.com/api/sso/callback/
KEYCLOAK_SCOPE=openid profile email
KEYCLOAK_VERIFY_AUDIENCE=true

# 신규 사용자 정책: auto | pending | deny
SSO_NEW_USER_POLICY=pending

# 로그인 성공/실패 시 이동
SSO_DEFAULT_NEXT_URL=https://app.example.com/
SSO_FAILED_REDIRECT_URL=https://app.example.com/login
SSO_ALLOWED_NEXT_ORIGINS=https://app.example.com,https://stg-app.example.com

# --- Cookie / CSRF (도메인 분리 시 중요) ---
SESSION_COOKIE_SAMESITE=None
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SAMESITE=None
CSRF_COOKIE_SECURE=true
CSRF_TRUSTED_ORIGINS=https://app.example.com,https://stg-app.example.com
```

## 8.2 Django URL 연결 예시

`backend/urls.py`:

```python
from django.urls import include, path

urlpatterns = [
    path("api/sso/", include("sso.urls", namespace="sso")),
]
```

## 8.3 Django REST 인증 설정 예시

`settings.py`:

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}
```

## 8.4 프론트 로그인 호출 예시 (React)

```js
const apiBase = import.meta.env.DEV ? "/api" : (import.meta.env.VITE_API_BASE || "/api");
const ssoLogin = (nextPath = window.location.origin + "/") => {
  const normalized = apiBase.endsWith("/") ? apiBase : `${apiBase}/`;
  window.location.assign(`${normalized}sso/login/?next=${encodeURIComponent(nextPath)}`);
};
```

## 8.5 프론트 세션 확인 예시 (axios)

```js
import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "/api",
  withCredentials: true,
});

export async function fetchSessionUser() {
  const { data } = await api.get("/sso/session/");
  return data; // { authenticated: boolean, user?: {...} }
}
```

## 8.6 보호 라우트 최소 예시

```jsx
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchSessionUser } from "./api";

export default function ProtectedRoute({ children }) {
  const [state, setState] = useState({ loading: true, ok: false });

  useEffect(() => {
    fetchSessionUser()
      .then((res) => setState({ loading: false, ok: !!res?.authenticated }))
      .catch(() => setState({ loading: false, ok: false }));
  }, []);

  if (state.loading) return null;
  if (!state.ok) return <Navigate to="/login" replace />;
  return children;
}
```

## 8.7 배포 전 점검 체크리스트

- Keycloak Redirect URI / Post Logout URI가 실제 배포 도메인과 정확히 일치
- `SSO_ALLOWED_NEXT_ORIGINS`에 프론트 origin만 등록
- HTTPS 환경에서 `SESSION_COOKIE_SECURE=true`, `CSRF_COOKIE_SECURE=true`
- 브라우저 devtools에서 `/api/sso/session/` 요청에 쿠키가 포함되는지 확인
- 실패 시 `sso_error` 쿼리(`invalid_state`, `callback_failed` 등) 처리 확인

## 9. 기존 사용자 이전: `sync_keycloak_users`

기존 Django 사용자를 Keycloak에 이관/연결할 때는 아래 커맨드를 사용합니다.

관련 코드:

- [sync_keycloak_users.py](/home/pengejeen/p6ix-CPE/backend/sso/management/commands/sync_keycloak_users.py)

동작 요약:

- 이메일 기준으로 Keycloak 사용자 조회
- 있으면 로컬 `keycloak_sub` 연결
- 없으면 Keycloak 사용자 생성 후 `keycloak_sub` 연결
- 기본은 **dry-run**이며, 실제 반영은 `--apply`가 필요

## 9.1 실행 위치

`manage.py`가 있는 `backend` 디렉터리에서 실행:

```bash
cd backend
python3 manage.py sync_keycloak_users
```

또는 저장소 루트에서:

```bash
python3 backend/manage.py sync_keycloak_users
```

## 9.2 권장 실행 순서

1. Dry-run으로 대상/결과 확인

```bash
python3 manage.py sync_keycloak_users
```

2. 이상 없으면 실제 반영

```bash
python3 manage.py sync_keycloak_users --apply
```

3. 대량 이전 전 샘플 검증(예: 20명)

```bash
python3 manage.py sync_keycloak_users --limit 20
python3 manage.py sync_keycloak_users --limit 20 --apply
```

## 9.3 자주 쓰는 옵션

- `--apply`: 실제 반영(미지정 시 dry-run)
- `--include-inactive`: 비활성 사용자 포함
- `--include-empty-email`: 이메일 없는 사용자도 처리 시도
- `--include-linked`: 이미 `keycloak_sub` 있는 사용자도 포함
- `--limit N`: 처리 수 제한
- `--email-verified`: 신규 Keycloak 유저 생성 시 emailVerified=true
- `--temporary-password <pw>`: 신규 생성 사용자 초기 비밀번호 설정
- `--password-not-temporary`: 임시 비밀번호가 아닌 일반 비밀번호로 설정
- `--use-django-password-hash`: Django PBKDF2 해시를 Keycloak credential 형식으로 변환/적용

관리자 토큰 관련(필요 시 커맨드 인자로 override):

- `--admin-client-id`, `--admin-client-secret`
- `--admin-realm`
- `--keycloak-realm`
- `--server-url`

## 9.4 필수 환경변수 (이관 커맨드용)

아래 값이 없으면 커맨드가 실패합니다.

- `KEYCLOAK_SERVER_URL`
- `KEYCLOAK_REALM` (target realm)
- `KEYCLOAK_ADMIN_CLIENT_ID`
- `KEYCLOAK_ADMIN_CLIENT_SECRET`
- 선택: `KEYCLOAK_ADMIN_REALM` (미지정 시 `KEYCLOAK_REALM` 사용)

## 9.5 실행 예시

Dry-run:

```bash
python3 manage.py sync_keycloak_users \
  --server-url https://keycloak.example.com \
  --keycloak-realm my-realm \
  --admin-realm master \
  --admin-client-id admin-cli \
  --admin-client-secret '***'
```

실반영 + 이메일 검증 + 초기 비밀번호 부여:

```bash
python3 manage.py sync_keycloak_users \
  --apply \
  --email-verified \
  --temporary-password 'TempPass!123'
```

## 9.6 결과 해석

요약 라인에 아래 카운트가 출력됩니다.

- `linked_existing`: 기존 Keycloak 계정과 연결 성공
- `created`: Keycloak 신규 생성 + 연결 성공
- `dry_run_would_link`, `dry_run_would_create`: dry-run 예상치
- `skipped_no_email`: 이메일 누락으로 스킵
- `skipped_multi_match`: 동일 이메일 다중 매치로 스킵
- `errors`: 예외 발생 건수

`errors > 0`이면 그대로 운영 반영하지 말고 원인(권한, realm, 중복 이메일, 네트워크)을 먼저 정리한 뒤 재실행하세요.
