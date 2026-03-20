from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from cpe_all_module.models import (
    CIPProductivityBasis,
    ConstructionScheduleItem,
    PileProductivityBasis,
)
from cpe_module.models.project_models import Project


AUTH_DENIED_STATUS_CODES = {
    status.HTTP_401_UNAUTHORIZED,
    status.HTTP_403_FORBIDDEN,
}

AUTH_REQUIRED_ENDPOINTS = (
    "/api/cpe-all/cip-basis/",
    "/api/cpe-all/cip-result/",
    "/api/cpe-all/cip-standard/",
    "/api/cpe-all/pile-basis/",
    "/api/cpe-all/pile-result/",
    "/api/cpe-all/pile-standard/",
    "/api/cpe-all/schedule-item/",
)


class CpeAllApiSmokeTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="cpe_all_user",
            password="StrongPass!123",
            email="cpe_all@example.com",
        )
        self.other_user = user_model.objects.create_user(
            username="cpe_all_other_user",
            password="StrongPass!123",
            email="cpe_all_other@example.com",
        )
        self.own_project = Project.objects.create(
            user=self.user,
            title="Own Total Project",
            calc_type="TOTAL",
        )
        self.other_project = Project.objects.create(
            user=self.other_user,
            title="Other Total Project",
            calc_type="TOTAL",
        )

    def test_key_viewsets_require_authentication(self):
        for endpoint in AUTH_REQUIRED_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertIn(response.status_code, AUTH_DENIED_STATUS_CODES)

    def test_key_viewsets_allow_authenticated_access(self):
        self.client.force_authenticate(user=self.user)

        for endpoint in AUTH_REQUIRED_ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(endpoint)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_schedule_detail_and_filter_block_other_users_project(self):
        own_item = ConstructionScheduleItem.objects.create(
            project=self.own_project,
            data={"items": []},
        )
        other_item = ConstructionScheduleItem.objects.create(
            project=self.other_project,
            data={"items": [{"id": "other"}]},
        )
        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"/api/cpe-all/schedule-item/?project_id={self.other_project.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        response = self.client.get(f"/api/cpe-all/schedule-item/{other_item.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.get(f"/api/cpe-all/schedule-item/{own_item.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_initialize_default_blocks_other_users_project(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.post(
            "/api/cpe-all/schedule-item/initialize_default/",
            {"project_id": str(self.other_project.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cip_and_pile_filters_block_other_users_project(self):
        CIPProductivityBasis.objects.create(
            project=self.own_project,
            description="own-cip",
        )
        CIPProductivityBasis.objects.create(
            project=self.other_project,
            description="other-cip",
        )
        PileProductivityBasis.objects.create(
            project=self.own_project,
            description="own-pile",
        )
        PileProductivityBasis.objects.create(
            project=self.other_project,
            description="other-pile",
        )

        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"/api/cpe-all/cip-basis/?project={self.other_project.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        response = self.client.get(
            f"/api/cpe-all/cip-basis/?project={self.own_project.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        response = self.client.get(
            f"/api/cpe-all/pile-basis/?project={self.other_project.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, [])

        response = self.client.get(
            f"/api/cpe-all/pile-basis/?project={self.own_project.id}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
