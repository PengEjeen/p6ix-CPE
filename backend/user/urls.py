from django.urls import path
from .views import (
    RegisterView,
    CustomTokenObtainPairView,
    ProfileView,
    LogoutView,
    ChangePasswordView,
    KeycloakLoginView,
)
from sso.views import SessionUserView, SSOCallbackView, SSOLoginRedirectView
from .google_auth import GoogleLoginView, GoogleClientIdView
from rest_framework_simplejwt.views import TokenRefreshView

app_name = 'user'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('password_change/', ChangePasswordView.as_view(), name='password_change'),
    path('keycloak/login/', KeycloakLoginView.as_view(), name='keycloak_login'),
    # Backward compatibility routes for old client settings
    path('sso/login/', SSOLoginRedirectView.as_view(), name='legacy_sso_login'),
    path('auth/callback/', SSOCallbackView.as_view(), name='legacy_sso_callback'),
    path('session/', SessionUserView.as_view(), name='legacy_sso_session'),
    # Google OAuth
    path('google/login/', GoogleLoginView.as_view(), name='google_login'),
    path('google/client-id/', GoogleClientIdView.as_view(), name='google_client_id'),
]
