from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase


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
