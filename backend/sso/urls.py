from django.urls import path

from .views import SessionUserView, SSOCallbackView, SSOLoginRedirectView, SSOLogoutView

app_name = "sso"

urlpatterns = [
    path("login/", SSOLoginRedirectView.as_view(), name="login"),
    path("callback/", SSOCallbackView.as_view(), name="callback"),
    path("logout/", SSOLogoutView.as_view(), name="logout"),
    path("session/", SessionUserView.as_view(), name="session"),
]
