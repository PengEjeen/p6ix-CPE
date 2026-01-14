import os
import django
import sys
import datetime

# Setup
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from cpe_module.models.project_models import Project
from django.contrib.auth import get_user_model

User = get_user_model()

def check_project_date():
    try:
        user = User.objects.first()
        if not user:
            print("No user found")
            return

        # Create or Get a test project
        project = Project.objects.filter(user=user, title="Test Date Project").first()
        if not project:
            project = Project.objects.create(
                user=user, 
                title="Test Date Project",
                start_date=datetime.date(2025, 1, 1)
            )
            print(f"Created Project: {project.id}, Start Date: {project.start_date}")
        else:
            print(f"Found Project: {project.id}, Start Date: {project.start_date}")
            project.start_date = datetime.date(2025, 12, 25)
            project.save()
            print(f"Updated Project Start Date to: {project.start_date}")
            
        # Verify persistence
        p_refresh = Project.objects.get(id=project.id)
        print(f"Refetched Project Start Date: {p_refresh.start_date}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    check_project_date()
