from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import SimpleTestCase
from rest_framework import status
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.test import APITestCase

from user.google_auth import GoogleLoginView
from user.views import (
    CustomTokenObtainPairView,
    KeycloakLoginView,
    RegisterView,
    ThrottledTokenRefreshView,
)


AUTH_DENIED_STATUS_CODES = {
    status.HTTP_401_UNAUTHORIZED,
    status.HTTP_403_FORBIDDEN,
}


class UserApiSmokeTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="smoke_user",
            password="StrongPass!123",
            email="smoke@example.com",
        )

    def test_register_allows_unauthenticated_access(self):
        payload = {
            "username": "new_user",
            "email": "new_user@example.com",
            "password": "StrongPass!123",
            "company": "P6IX",
            "department": "QA",
            "position": "Engineer",
        }

        response = self.client.post("/api/users/register/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], payload["username"])

    def test_profile_requires_authentication(self):
        response = self.client.get("/api/users/profile/")
        self.assertIn(response.status_code, AUTH_DENIED_STATUS_CODES)

    def test_profile_returns_current_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/users/profile/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], self.user.username)


class AuthThrottleConfigTests(SimpleTestCase):
    def test_rest_framework_default_throttle_settings_exist(self):
        throttle_classes = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_CLASSES", ())
        throttle_rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})

        self.assertIn("rest_framework.throttling.AnonRateThrottle", throttle_classes)
        self.assertIn("rest_framework.throttling.UserRateThrottle", throttle_classes)
        self.assertIn("auth", throttle_rates)

    def test_auth_endpoints_use_scoped_throttle(self):
        auth_views = (
            RegisterView,
            CustomTokenObtainPairView,
            KeycloakLoginView,
            ThrottledTokenRefreshView,
            GoogleLoginView,
        )

        for view in auth_views:
            with self.subTest(view=view.__name__):
                self.assertEqual(view.throttle_scope, "auth")
                self.assertIn(ScopedRateThrottle, view.throttle_classes)
