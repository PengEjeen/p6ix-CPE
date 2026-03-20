from django.contrib.auth import get_user_model
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APITestCase

from cpe_module.models.calc_models import ConstructionOverview
from cpe_module.models.criteria_models import PreparationWork
from cpe_module.models.project_models import Project
from cpe_module.models.quotation_models import Quotation


AUTH_DENIED_STATUS_CODES = {
    status.HTTP_401_UNAUTHORIZED,
    status.HTTP_403_FORBIDDEN,
}


class ProjectApiSmokeTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(
            username="project_owner",
            password="StrongPass!123",
            email="owner@example.com",
        )
        self.other_user = user_model.objects.create_user(
            username="project_other",
            password="StrongPass!123",
            email="other@example.com",
        )

    def test_project_list_requires_authentication(self):
        response = self.client.get("/api/cpe/project/")
        self.assertIn(response.status_code, AUTH_DENIED_STATUS_CODES)

    def test_project_list_returns_only_current_users_non_deleted_projects(self):
        own_active = Project.objects.create(
            user=self.user,
            title="Owner Active",
            calc_type="APARTMENT",
        )
        Project.objects.create(
            user=self.user,
            title="Owner Deleted",
            calc_type="TOTAL",
            is_delete=True,
        )
        Project.objects.create(
            user=self.other_user,
            title="Other Active",
            calc_type="APARTMENT",
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/cpe/project/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["results"]), 1)
        self.assertEqual(response.data["results"][0]["id"], str(own_active.id))

    def test_calc_endpoints_block_other_users_project(self):
        other_project = Project.objects.create(
            user=self.other_user,
            title="Other Calc Project",
            calc_type="APARTMENT",
        )
        ConstructionOverview.objects.create(project=other_project)

        self.client.force_authenticate(user=self.user)

        response = self.client.get(
            f"/api/cpe/calc/construction-overview/{other_project.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.get(
            f"/api/cpe/calc/work-condition/{other_project.id}/"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_criteria_endpoints_block_other_users_project(self):
        other_project = Project.objects.create(
            user=self.other_user,
            title="Other Criteria Project",
            calc_type="APARTMENT",
        )
        PreparationWork.objects.create(project=other_project)

        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/cpe/criteria/preparation/{other_project.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_quotation_endpoint_blocks_other_users_project(self):
        other_project = Project.objects.create(
            user=self.other_user,
            title="Other Quotation Project",
            calc_type="APARTMENT",
        )
        Quotation.objects.create(project=other_project)

        self.client.force_authenticate(user=self.user)
        response = self.client.get(f"/api/cpe/quotation/{other_project.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_ai_quotation_requires_authentication(self):
        own_project = Project.objects.create(
            user=self.user,
            title="Own Quotation Project",
            calc_type="APARTMENT",
        )
        Quotation.objects.create(project=own_project)

        response = self.client.post(f"/api/cpe/quotation/{own_project.id}/ai_update/")

        self.assertIn(response.status_code, AUTH_DENIED_STATUS_CODES)

    @patch("cpe_module.views.quotation.enqueue_task")
    def test_ai_quotation_blocks_other_users_project(self, mock_enqueue_task):
        other_project = Project.objects.create(
            user=self.other_user,
            title="Other Quotation Project 2",
            calc_type="APARTMENT",
        )
        Quotation.objects.create(project=other_project)

        self.client.force_authenticate(user=self.user)
        response = self.client.post(f"/api/cpe/quotation/{other_project.id}/ai_update/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        mock_enqueue_task.assert_not_called()
