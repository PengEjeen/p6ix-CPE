import logging

from django.conf import settings
from django.contrib.auth import logout as django_logout
from rest_framework import generics, permissions, status, views
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from sso.keycloak_auth import KeycloakAuthError, KeycloakTokenVerifier
from sso.services import LocalUserSyncMixin

from .serializers import (
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    RegisterSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request, *args, **kwargs):
        if not getattr(settings, "LEGACY_LOCAL_LOGIN_ENABLED", False):
            return Response(
                {"error": "legacy_local_login_disabled"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().post(request, *args, **kwargs)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class LogoutView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass

        django_logout(request)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class KeycloakLoginView(views.APIView, LocalUserSyncMixin):
    """Legacy bridge endpoint: Keycloak token -> local JWT issuance."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        if not getattr(settings, "LEGACY_BRIDGE_JWT_ENABLED", False):
            return Response(
                {"error": "legacy_bridge_jwt_disabled"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not getattr(settings, "KEYCLOAK_ENABLED", False):
            return Response(
                {"error": "keycloak_disabled"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        access_token = request.data.get("access_token")
        if not access_token:
            return Response(
                {"error": "access_token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            claims = KeycloakTokenVerifier().verify_access_token(access_token)
            user, user_status = self.sync_user_from_claims(claims)
            if user_status == "pending" or not user.is_active:
                return Response(
                    {"error": "pending_approval"},
                    status=status.HTTP_403_FORBIDDEN,
                )
        except KeycloakAuthError as exc:
            logger.warning("Keycloak token verification failed: %s", exc)
            return Response({"error": "invalid_keycloak_token"}, status=status.HTTP_401_UNAUTHORIZED)
        except PermissionError as exc:
            logger.warning("Keycloak user sync denied: %s", exc)
            return Response({"error": "not_registered"}, status=status.HTTP_403_FORBIDDEN)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected keycloak login error: %s", exc)
            return Response(
                {"error": "keycloak_authentication_failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        refresh = RefreshToken.for_user(user)
        refresh["username"] = user.username
        refresh["role"] = user.role
        refresh["company"] = user.company

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class ChangePasswordView(generics.UpdateAPIView):
    serializer_class = ChangePasswordSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        if self.request.user.login_provider != "local":
            return Response(
                {"detail": "SSO 사용자는 Keycloak에서 비밀번호를 변경하세요."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.request.user.set_password(serializer.data.get("new_password"))
        self.request.user.save(update_fields=["password"])

        return Response(
            {
                "status": "success",
                "code": status.HTTP_200_OK,
                "message": "비밀번호가 성공적으로 변경되었습니다.",
            }
        )


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
