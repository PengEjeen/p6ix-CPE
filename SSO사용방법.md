# SSO 사용 방법 (이 프로젝트 기준 + 타 프로젝트 이식 가이드)

## 1) 이 프로젝트에서 통합로그인(SSO)이 동작하는 방식

이 프로젝트는 **Keycloak + OIDC Authorization Code**를 사용하고, 로그인 완료 후에는 **Django SessionAuthentication** 기반으로 인증 상태를 유지합니다.

- 백엔드 SSO 엔드포인트
  - `GET /api/sso/login/`
  - `GET /api/sso/callback/`
  - `GET /api/sso/logout/`
  - `GET /api/sso/session/`
- 프론트는 로그인 버튼 클릭 시 `/api/sso/login/?next=...` 로 이동합니다.
- 백엔드는 state/nonce를 세션에 저장한 뒤 Keycloak 인증 페이지로 리다이렉트합니다.
- callback에서 code를 token으로 교환하고 JWT 서명/issuer/audience/nonce를 검증합니다.
- claims로 로컬 유저를 찾거나 생성한 뒤(`keycloak_sub` 또는 email 기준), `django_login()`으로 세션 로그인합니다.
- 프론트는 `/api/sso/session/` 호출로 로그인 여부/사용자 정보를 확인합니다.

핵심은 "토큰을 프론트 localStorage에서 직접 관리"하는 방식이 아니라, **서버 세션을 신뢰원으로 사용**한다는 점입니다.

---

## 2) 현재 구현에서 꼭 알아야 할 정책

### 유저 동기화 정책 (`SSO_NEW_USER_POLICY`)

- `auto`: 신규 사용자를 활성 상태로 자동 생성
- `pending`: 신규 사용자 생성은 하되 `is_active=False`로 대기
- `deny`: 기존 사용자만 로그인 허용 (미등록자는 거부)

### 권한(role) 매핑

- 토큰 role에 `admin` 또는 `superuser`가 있으면 로컬 role=`admin`
- 그 외는 role=`user`

### 안전한 리다이렉트(next) 처리

- 상대경로(`/...`)는 허용
- 절대 URL은 `SSO_ALLOWED_NEXT_ORIGINS`에 등록된 origin만 허용
- 그 외는 `SSO_DEFAULT_NEXT_URL`로 폴백

---

## 3) 필수 환경변수

## 백엔드 (Django)

- `KEYCLOAK_ENABLED=true`
- `KEYCLOAK_SERVER_URL` (예: `http://localhost:8080`)
- `KEYCLOAK_REALM`
- `KEYCLOAK_CLIENT_ID`
- `KEYCLOAK_CLIENT_SECRET` (선택, 클라이언트 타입에 따라 필요)
- `KEYCLOAK_REDIRECT_URI` (예: `http://localhost:8000/api/sso/callback/`)
- `KEYCLOAK_SCOPE` (기본 `openid profile email`)
- `KEYCLOAK_VERIFY_AUDIENCE=true`
- `SSO_NEW_USER_POLICY` (`auto|pending|deny`)
- `SSO_DEFAULT_NEXT_URL`
- `SSO_FAILED_REDIRECT_URL`
- `SSO_ALLOWED_NEXT_ORIGINS` (콤마 리스트)

쿠키/CSRF 관련(프론트-백 분리 도메인일 때 중요):

- `SESSION_COOKIE_SAMESITE`
- `SESSION_COOKIE_SECURE`
- `CSRF_COOKIE_SAMESITE`
- `CSRF_COOKIE_SECURE`
- `CSRF_TRUSTED_ORIGINS`

## 프론트엔드 (Vite)

- `VITE_USE_SESSION_AUTH=true`
- `VITE_KEYCLOAK_ENABLED=true`
- `VITE_API_BASE=/api` (또는 실제 API 주소)
- 선택: `VITE_SSO_NEXT_PATH` (로그인 성공 후 이동할 경로/URL)

참고: 현재 코드에서는 `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID` 값을 직접 사용하지 않고, 실제 인증 플로우는 백엔드 `/api/sso/*`를 통해 수행합니다.

---

## 4) 타 프로젝트로 이식하는 방법

## A. 백엔드 이식

1. 사용자 모델에 아래 필드를 추가합니다.
   - `keycloak_sub` (unique, nullable)
   - `login_provider` (기본값 `local`)
   - `role` (선택)
2. SSO 모듈(뷰/토큰검증/유저동기화)을 추가합니다.
   - 로그인 리다이렉트
   - callback(code 교환 + 토큰 검증)
   - 세션 확인
   - 로그아웃
3. URL 라우팅을 추가합니다.
   - `/api/sso/login/`, `/api/sso/callback/`, `/api/sso/logout/`, `/api/sso/session/`
4. 인증 클래스를 세션 기반으로 활성화합니다.
   - `SessionAuthentication` 사용
5. 마이그레이션 후, 기존 사용자 연동 정책을 정합니다.
   - email 매칭 허용 여부
   - 신규 생성 정책(`auto|pending|deny`)

## B. 프론트엔드 이식

1. 로그인 페이지에서 `/api/sso/login/?next=...` 로 이동하도록 버튼 연결
2. 앱 진입/보호 라우트에서 `/api/sso/session/`으로 인증 상태 점검
3. 로그아웃 시 `/api/sso/logout/?next=...`로 이동
4. axios/fetch에서 `withCredentials: true` 설정
5. 세션 모드에서는 Bearer refresh 로직을 비활성 또는 분기 처리

## C. Keycloak 설정 체크리스트

1. Realm 생성
2. Client 생성
   - Redirect URI: 백엔드 callback (`.../api/sso/callback/`)
   - Post logout redirect URI: 프론트 로그인 경로
3. 필요한 클레임(email, preferred_username, name 등) 매퍼 확인
4. role 클레임(`realm_access`, `resource_access`) 전달 확인

---

## 5) 점진 이행(기존 JWT 로그인 병행) 전략

이 프로젝트에는 레거시 병행 옵션도 있습니다.

- `LEGACY_LOCAL_LOGIN_ENABLED`
- `LEGACY_BRIDGE_JWT_ENABLED`

권장 순서:

1. SSO 세션 로그인 우선 적용
2. 기존 사용자 매핑 안정화(`keycloak_sub` 링크)
3. 레거시 로그인 점진 차단

---

## 6) 자주 발생하는 오류 코드

- `keycloak_disabled`: 백엔드 Keycloak 설정 비활성
- `invalid_state`: callback state 불일치(CSRF 방어 실패)
- `pending_approval`: 계정 생성은 됐지만 활성화 대기
- `not_registered`: 정책이 `deny`이고 미등록 사용자
- `callback_failed`: 토큰 교환/검증/유저동기화 중 예외

---

## 7) 운영 시 주의사항

1. `.env`의 비밀키/토큰/DB 비밀번호는 절대 저장소에 커밋하지 마세요.
2. 프론트-백 도메인이 다르면 SameSite/CSRF 설정을 반드시 HTTPS 기준으로 맞추세요.
3. `SSO_ALLOWED_NEXT_ORIGINS`를 최소 범위로 유지해 오픈 리다이렉트를 방지하세요.
4. `KEYCLOAK_VERIFY_AUDIENCE=true`를 유지해 다른 클라이언트용 토큰 오용을 막으세요.
