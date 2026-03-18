from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from urllib.parse import urlparse

from .keycloak_auth import KeycloakClaims

User = get_user_model()


def is_safe_next_path(path: str, fallback: str = "/") -> str:
    candidate = (path or "").strip()
    if not candidate:
        return fallback

    # same-origin path
    if candidate.startswith("/") and not candidate.startswith("//"):
        return candidate

    # allowlisted absolute URL (for separated frontend origin)
    parsed = urlparse(candidate)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        origin = f"{parsed.scheme}://{parsed.netloc}"
        allowed = set(getattr(settings, "SSO_ALLOWED_NEXT_ORIGINS", []) or [])
        if origin in allowed:
            return candidate

    return fallback


class LocalUserSyncMixin:
    @staticmethod
    def resolve_role(roles: list[str]) -> str:
        admin_markers = {"admin", "superuser"}
        return "admin" if any(role in admin_markers for role in roles) else "user"

    @staticmethod
    def ensure_unique_username(base_username: str) -> str:
        candidate = base_username[:150]
        if not User.objects.filter(username=candidate).exists():
            return candidate

        suffix = 1
        while True:
            trimmed = base_username[:140]
            candidate = f"{trimmed}_{suffix}"[:150]
            if not User.objects.filter(username=candidate).exists():
                return candidate
            suffix += 1

    def sync_user_from_claims(self, claims: KeycloakClaims):
        """
        Returns: (user, status)
          - status='ok'
          - status='pending' (new user created but inactive)
        """
        policy = (getattr(settings, "SSO_NEW_USER_POLICY", "auto") or "auto").strip().lower()
        if policy not in {"auto", "pending", "deny"}:
            policy = "auto"

        with transaction.atomic():
            user = User.objects.filter(keycloak_sub=claims.sub).first()

            if not user and claims.email:
                user = User.objects.filter(email=claims.email).first()

            if not user and policy == "deny":
                raise PermissionError("not_registered")

            status_tag = "ok"
            if not user:
                base_username = claims.preferred_username or (
                    claims.email.split("@")[0] if claims.email else ""
                )
                if not base_username:
                    base_username = f"kc_{claims.sub[:8]}"

                user = User.objects.create(
                    username=self.ensure_unique_username(base_username),
                    email=claims.email,
                    first_name=claims.given_name
                    or (claims.full_name.split(" ")[0] if claims.full_name else ""),
                    last_name=claims.family_name,
                    login_provider="keycloak",
                    keycloak_sub=claims.sub,
                    role=self.resolve_role(claims.roles),
                    is_active=(policy == "auto"),
                )
                if policy == "pending":
                    status_tag = "pending"
                return user, status_tag

            user.login_provider = "keycloak"
            user.keycloak_sub = claims.sub
            if claims.email:
                user.email = claims.email
            if claims.given_name:
                user.first_name = claims.given_name
            if claims.family_name:
                user.last_name = claims.family_name
            user.role = self.resolve_role(claims.roles)
            user.save(
                update_fields=[
                    "login_provider",
                    "keycloak_sub",
                    "email",
                    "first_name",
                    "last_name",
                    "role",
                ]
            )
            return user, "ok"
