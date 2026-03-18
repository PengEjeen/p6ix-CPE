from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import jwt
from django.conf import settings


class KeycloakAuthError(Exception):
    """Raised when a Keycloak token cannot be trusted."""


@dataclass
class KeycloakClaims:
    sub: str
    email: str
    preferred_username: str
    given_name: str
    family_name: str
    full_name: str
    roles: list[str]
    raw: dict[str, Any]


class KeycloakTokenVerifier:
    def __init__(self) -> None:
        server = (getattr(settings, "KEYCLOAK_SERVER_URL", "") or "").rstrip("/")
        realm = getattr(settings, "KEYCLOAK_REALM", "")
        if not server or not realm:
            raise KeycloakAuthError("Keycloak 설정(KEYCLOAK_SERVER_URL/REALM)이 없습니다.")

        self.client_id = getattr(settings, "KEYCLOAK_CLIENT_ID", "")
        self.verify_audience = bool(getattr(settings, "KEYCLOAK_VERIFY_AUDIENCE", True))

        self.issuer = f"{server}/realms/{realm}"
        jwks_url = f"{self.issuer}/protocol/openid-connect/certs"
        self.jwks_client = jwt.PyJWKClient(jwks_url)

    def verify_access_token(self, token: str) -> KeycloakClaims:
        if not token:
            raise KeycloakAuthError("access_token이 비어 있습니다.")

        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            payload: dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "RS384", "RS512"],
                issuer=self.issuer,
                options={"verify_aud": False},
            )
        except Exception as exc:  # noqa: BLE001
            raise KeycloakAuthError(f"Keycloak 토큰 검증 실패: {exc}") from exc

        if self.verify_audience and self.client_id:
            aud = payload.get("aud")
            azp = payload.get("azp")
            aud_list = [aud] if isinstance(aud, str) else (aud or [])
            if self.client_id not in aud_list and azp != self.client_id:
                raise KeycloakAuthError("토큰 audience/azp가 현재 클라이언트와 일치하지 않습니다.")

        sub = str(payload.get("sub") or "").strip()
        if not sub:
            raise KeycloakAuthError("토큰에 sub 클레임이 없습니다.")

        return KeycloakClaims(
            sub=sub,
            email=str(payload.get("email") or "").strip(),
            preferred_username=str(payload.get("preferred_username") or "").strip(),
            given_name=str(payload.get("given_name") or "").strip(),
            family_name=str(payload.get("family_name") or "").strip(),
            full_name=str(payload.get("name") or "").strip(),
            roles=self._extract_roles(payload),
            raw=payload,
        )

    def verify_id_token(self, token: str, expected_nonce: Optional[str] = None) -> KeycloakClaims:
        if not token:
            raise KeycloakAuthError("id_token이 비어 있습니다.")

        if not self.client_id:
            raise KeycloakAuthError("KEYCLOAK_CLIENT_ID 설정이 없습니다.")

        try:
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            payload: dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256", "RS384", "RS512"],
                issuer=self.issuer,
                audience=self.client_id,
            )
        except Exception as exc:  # noqa: BLE001
            raise KeycloakAuthError(f"Keycloak ID 토큰 검증 실패: {exc}") from exc

        if expected_nonce:
            nonce = payload.get("nonce")
            if nonce != expected_nonce:
                raise KeycloakAuthError("ID 토큰 nonce가 일치하지 않습니다.")

        sub = str(payload.get("sub") or "").strip()
        if not sub:
            raise KeycloakAuthError("ID 토큰에 sub 클레임이 없습니다.")

        return KeycloakClaims(
            sub=sub,
            email=str(payload.get("email") or "").strip(),
            preferred_username=str(payload.get("preferred_username") or "").strip(),
            given_name=str(payload.get("given_name") or "").strip(),
            family_name=str(payload.get("family_name") or "").strip(),
            full_name=str(payload.get("name") or "").strip(),
            roles=self._extract_roles(payload),
            raw=payload,
        )

    def _extract_roles(self, payload: dict[str, Any]) -> list[str]:
        roles: set[str] = set()

        realm_access = payload.get("realm_access") or {}
        if isinstance(realm_access, dict):
            for role in realm_access.get("roles") or []:
                if isinstance(role, str):
                    roles.add(role)

        resource_access = payload.get("resource_access") or {}
        if isinstance(resource_access, dict) and self.client_id:
            client_access = resource_access.get(self.client_id) or {}
            if isinstance(client_access, dict):
                for role in client_access.get("roles") or []:
                    if isinstance(role, str):
                        roles.add(role)

        return sorted(roles)
