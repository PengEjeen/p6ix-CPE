import os
import django
import sys
import json

# Setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from django.test import Client
from django.contrib.auth import get_user_model
from cpe_module.models.project_models import Project
from cpe_all_module.models.construction_schedule_models import ConstructionScheduleItem

User = get_user_model()

def check_save_api():
    try:
        user = User.objects.first()
        if not user:
            print("No user found")
            return
            
        print(f"Using User: {user.username}")
        client = Client()
        client.force_login(user)
        
        # 1. Get or Create Project
        project = Project.objects.filter(user=user, title="Test Date Project").first()
        if not project:
            project = Project.objects.create(user=user, title="Test Date Project")
            
        # 2. Get Container
        container, _ = ConstructionScheduleItem.objects.get_or_create(project=project)
        print(f"Testing Container ID: {container.id}")
        
        # 3. Payload
        payload = {
            "data": [
                {"id": "test-1", "name": "Test Item 1", "value": 100},
                {"id": "test-2", "name": "Test Item 2", "value": 200}
            ]
        }
        
        # 4. Send PATCH
        print(f"Sending PATCH to /api/cpe-all/schedule-item/{container.id}/")
        
        # NOTE: Using partial update
        response = client.patch(
            f"/api/cpe-all/schedule-item/{container.id}/",
            data=json.dumps(payload),
            content_type="application/json"
        )
        
        print(f"Response Status: {response.status_code}")
        if response.status_code != 200:
            print("Response Error:", response.content.decode())
        else:
            print("Response Data:", response.json())
            
        # 5. Verify DB
        container.refresh_from_db()
        print("DB Verified Data Length:", len(container.data))
        print("DB Data sample:", container.data[:1])

    except Exception as e:
        print(f"Script Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_save_api()
