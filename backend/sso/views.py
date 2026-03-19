import json
import logging
import re
import secrets
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.http import HttpResponseRedirect
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status, views
from rest_framework.response import Response

from user.serializers import UserSerializer

from .keycloak_auth import KeycloakAuthError, KeycloakClaims, KeycloakTokenVerifier
from .services import LocalUserSyncMixin, is_safe_next_path

logger = logging.getLogger(__name__)
IDP_ALIAS_PATTERN = re.compile(r"^[A-Za-z0-9._-]+$")


def append_query_param(url: str, key: str, value: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query[key] = value
    return urlunparse(parsed._replace(query=urlencode(query)))


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SessionUserView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user or not request.user.is_authenticated:
            return Response({"authenticated": False}, status=status.HTTP_200_OK)

        return Response(
            {
                "authenticated": True,
                "user": UserSerializer(request.user).data,
            },
            status=status.HTTP_200_OK,
        )


class SSOLoginRedirectView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not getattr(settings, "KEYCLOAK_ENABLED", False):
            return Response(
                {"error": "keycloak_disabled"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        redirect_uri = getattr(settings, "KEYCLOAK_REDIRECT_URI", "")
        if not redirect_uri:
            return Response(
                {"error": "missing_keycloak_redirect_uri"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        if not settings.KEYCLOAK_SERVER_URL or not settings.KEYCLOAK_REALM or not settings.KEYCLOAK_CLIENT_ID:
            return Response(
                {"error": "missing_keycloak_server_or_realm_or_client"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        next_path = is_safe_next_path(
            request.GET.get("next", ""),
            fallback=getattr(settings, "SSO_DEFAULT_NEXT_URL", "/"),
        )

        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)

        request.session["sso_state"] = state
        request.session["sso_nonce"] = nonce
        request.session["sso_next"] = next_path

        issuer = f"{settings.KEYCLOAK_SERVER_URL.rstrip('/')}/realms/{settings.KEYCLOAK_REALM}"
        authorize_url = f"{issuer}/protocol/openid-connect/auth"
        params = {
            "client_id": settings.KEYCLOAK_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": getattr(settings, "KEYCLOAK_SCOPE", "openid profile email"),
            "state": state,
            "nonce": nonce,
        }

        # Optional IdP hint (e.g. provider=google) to skip Keycloak username/password screen.
        provider = (request.GET.get("provider") or "").strip()
        if provider and IDP_ALIAS_PATTERN.fullmatch(provider):
            params["kc_idp_hint"] = provider

        return HttpResponseRedirect(f"{authorize_url}?{urlencode(params)}")


class SSOCallbackView(views.APIView, LocalUserSyncMixin):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        fallback = getattr(settings, "SSO_FAILED_REDIRECT_URL", "/login")
        next_path = is_safe_next_path(
            request.session.pop("sso_next", ""),
            fallback=getattr(settings, "SSO_DEFAULT_NEXT_URL", "/"),
        )

        if request.GET.get("error"):
            return HttpResponseRedirect(append_query_param(fallback, "sso_error", "cancelled"))

        code = request.GET.get("code")
        state = request.GET.get("state")
        expected_state = request.session.pop("sso_state", None)
        expected_nonce = request.session.pop("sso_nonce", None)

        if not code or not state or state != expected_state:
            return HttpResponseRedirect(append_query_param(fallback, "sso_error", "invalid_state"))

        try:
            token_data = self._exchange_code_for_token(code)
            id_token = token_data.get("id_token")
            access_token = token_data.get("access_token")
            if not access_token:
                raise KeycloakAuthError("token endpoint did not return access_token")

            verifier = KeycloakTokenVerifier()
            if id_token:
                claims = verifier.verify_id_token(id_token, expected_nonce=expected_nonce)
            else:
                claims = verifier.verify_access_token(access_token)

            if not claims.email or not claims.preferred_username:
                userinfo = self._fetch_userinfo(access_token)
                claims = self._merge_claims(claims, userinfo)

            user, user_status = self.sync_user_from_claims(claims)
            if user_status == "pending" or not user.is_active:
                return HttpResponseRedirect(append_query_param(fallback, "sso_error", "pending_approval"))

            django_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
            return HttpResponseRedirect(next_path)
        except PermissionError:
            return HttpResponseRedirect(append_query_param(fallback, "sso_error", "not_registered"))
        except Exception as exc:
            logger.exception("SSO callback failed: %s", exc)
            return HttpResponseRedirect(append_query_param(fallback, "sso_error", "callback_failed"))

    @staticmethod
    def _exchange_code_for_token(code: str) -> dict:
        if not settings.KEYCLOAK_SERVER_URL or not settings.KEYCLOAK_REALM or not settings.KEYCLOAK_CLIENT_ID:
            raise RuntimeError("missing_keycloak_server_or_realm_or_client")
        if not settings.KEYCLOAK_REDIRECT_URI:
            raise RuntimeError("missing_keycloak_redirect_uri")

        issuer = f"{settings.KEYCLOAK_SERVER_URL.rstrip('/')}/realms/{settings.KEYCLOAK_REALM}"
        token_endpoint = f"{issuer}/protocol/openid-connect/token"

        payload = {
            "grant_type": "authorization_code",
            "code": code,
            "client_id": settings.KEYCLOAK_CLIENT_ID,
            "redirect_uri": settings.KEYCLOAK_REDIRECT_URI,
        }
        client_secret = getattr(settings, "KEYCLOAK_CLIENT_SECRET", "")
        if client_secret:
            payload["client_secret"] = client_secret

        data = urlencode(payload).encode("utf-8")
        req = Request(
            token_endpoint,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )

        try:
            with urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body)
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"token_exchange_failed: {body}") from exc
        except URLError as exc:
            raise RuntimeError(f"token_endpoint_unreachable: {exc}") from exc

    @staticmethod
    def _fetch_userinfo(access_token: str) -> dict:
        issuer = f"{settings.KEYCLOAK_SERVER_URL.rstrip('/')}/realms/{settings.KEYCLOAK_REALM}"
        userinfo_endpoint = f"{issuer}/protocol/openid-connect/userinfo"
        req = Request(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
            method="GET",
        )

        try:
            with urlopen(req, timeout=10) as resp:
                body = resp.read().decode("utf-8")
                return json.loads(body)
        except Exception:
            return {}

    @staticmethod
    def _merge_claims(base_claims: KeycloakClaims, userinfo: dict) -> KeycloakClaims:
        return KeycloakClaims(
            sub=base_claims.sub,
            email=str(userinfo.get("email") or base_claims.email),
            preferred_username=str(userinfo.get("preferred_username") or base_claims.preferred_username),
            given_name=str(userinfo.get("given_name") or base_claims.given_name),
            family_name=str(userinfo.get("family_name") or base_claims.family_name),
            full_name=str(userinfo.get("name") or base_claims.full_name),
            roles=base_claims.roles,
            raw={**base_claims.raw, **userinfo},
        )


class SSOLogoutView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        next_url = is_safe_next_path(
            request.GET.get("next", ""),
            fallback=getattr(settings, "SSO_FAILED_REDIRECT_URL", "/login"),
        )

        django_logout(request)

        # Keycloak 세션도 함께 종료 (설정 미비 시 앱 로그인 화면으로만 복귀)
        if not settings.KEYCLOAK_ENABLED or not settings.KEYCLOAK_SERVER_URL or not settings.KEYCLOAK_REALM:
            return HttpResponseRedirect(next_url)

        issuer = f"{settings.KEYCLOAK_SERVER_URL.rstrip('/')}/realms/{settings.KEYCLOAK_REALM}"
        logout_endpoint = f"{issuer}/protocol/openid-connect/logout"
        params = {"post_logout_redirect_uri": next_url}
        if settings.KEYCLOAK_CLIENT_ID:
            params["client_id"] = settings.KEYCLOAK_CLIENT_ID

        return HttpResponseRedirect(f"{logout_endpoint}?{urlencode(params)}")
