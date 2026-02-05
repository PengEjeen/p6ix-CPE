
import sys
import os
import django
import json

sys.path.append('/home/pengejeen/p6ix-CPE/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from cpe_all_module.models.construction_schedule_models import ConstructionScheduleItem
from cpe_all_module.initial_data import get_default_schedule_data
from cpe_module.models import Project

def update_schedules():
    new_data = get_default_schedule_data()
    print(f"Loaded {len(new_data)} items from initial_data.py")
    
    # Update for all projects that have a schedule item container
    items = ConstructionScheduleItem.objects.all()
    count = 0
    for item in items:
        # Check if we should update. 
        # Strategy: overwrite completely to ensure consistency with new logic.
        print(f"Updating Project ID {item.project_id}...")
        item.data = new_data
        item.save()
        count += 1
        
    print(f"Updated {count} ConstructionScheduleItems.")
    
    # If no items exist, try creating one for the latest project if available
    if count == 0:
        latest_project = Project.objects.last()
        if latest_project:
            print(f"No existing schedule found. creating for Project {latest_project.id} ({latest_project.name})")
            ConstructionScheduleItem.objects.create(
                project=latest_project,
                data=new_data
            )
            print("Created new schedule item.")
        else:
            print("No projects found to update.")

if __name__ == "__main__":
    try:
        update_schedules()
    except Exception as e:
        print(f"Error: {e}")
