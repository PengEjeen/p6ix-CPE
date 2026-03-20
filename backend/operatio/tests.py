from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from operatio.models import WeatherStation


AUTH_DENIED_STATUS_CODES = {
    status.HTTP_401_UNAUTHORIZED,
    status.HTTP_403_FORBIDDEN,
}


class WeatherStationApiSmokeTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="operatio_user",
            password="StrongPass!123",
            email="operatio@example.com",
        )

    def test_weather_stations_requires_authentication(self):
        response = self.client.get("/api/operatio/weather-stations/")
        self.assertIn(response.status_code, AUTH_DENIED_STATUS_CODES)

    def test_weather_stations_returns_sorted_list_for_authenticated_user(self):
        WeatherStation.objects.create(station_id=200, name="Station B")
        WeatherStation.objects.create(station_id=100, name="Station A")
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/operatio/weather-stations/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            [
                {"station_id": 100, "name": "Station A"},
                {"station_id": 200, "name": "Station B"},
            ],
        )
