from django.core.management.base import BaseCommand
from cpe_all_module.models import CIPProductivityBasis
from cpe_module.models import Project

class Command(BaseCommand):
    help = 'Initialize CIP Productivity Basis Data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Initializing CIP Productivity Basis Data...")

        # Initialize Standard Template Data (project=None)
        
        # Data from User Image
        # Common: t1=3, dia=500, t3=2, t4_len=12, t4_time=5, f=0.8
        common = {
            "project": None,
            "t1": 3.0,
            "drill_diameter": 500,
            "t3": 2.0,
            "concrete_pouring_length": 12.0,
            "t4": 5.0,
            "classification_factor": 0.8
        }

        # Rows: Description, Clay, Sand, Weathered, Soft, Hard, Mixed, T2, T, Daily
        rows = [
            {
                "description": "CIP Standard (Clay 12m)",
                "clay": 12.0, "sand": 0, "weathered": 0, "soft": 0, "hard": 0, "mixed": 0,
                "t2": 10.92, "cycle_time": 26.15, "daily": 18.36
            },
            {
                "description": "CIP Standard (Sand 12m)",
                "clay": 0, "sand": 12.0, "weathered": 0, "soft": 0, "hard": 0, "mixed": 0,
                "t2": 14.16, "cycle_time": 30.20, "daily": 15.89
            },
            {
                "description": "CIP Standard (Weathered 12m)",
                "clay": 0, "sand": 0, "weathered": 12.0, "soft": 0, "hard": 0, "mixed": 0,
                "t2": 55.32, "cycle_time": 81.65, "daily": 5.88
            },
            {
                "description": "CIP Standard (Soft Rock 12m)",
                "clay": 0, "sand": 0, "weathered": 0, "soft": 12.0, "hard": 0, "mixed": 0,
                "t2": 125.76, "cycle_time": 169.70, "daily": 2.83
            },
            {
                "description": "CIP Standard (Hard Rock 12m)",
                "clay": 0, "sand": 0, "weathered": 0, "soft": 0, "hard": 12.0, "mixed": 0,
                "t2": 175.32, "cycle_time": 231.65, "daily": 2.07
            },
            {
                "description": "CIP Standard (Mixed 12m)",
                "clay": 0, "sand": 0, "weathered": 0, "soft": 0, "hard": 0, "mixed": 12.0,
                "t2": 48.12, "cycle_time": 72.65, "daily": 6.61
            },
        ]

        count = 0
        for r in rows:
            obj, created = CIPProductivityBasis.objects.update_or_create(
                description=r["description"],
                project=None,
                defaults={
                    **common,
                    "layer_depth_clay": r["clay"],
                    "layer_depth_sand": r["sand"],
                    "layer_depth_weathered": r["weathered"],
                    "layer_depth_soft_rock": r["soft"],
                    "layer_depth_hard_rock": r["hard"],
                    "layer_depth_mixed": r["mixed"],
                    "total_depth": 12.0,
                    
                    "t2": r["t2"],
                    "cycle_time": r["cycle_time"],
                    "daily_production_count": r["daily"]
                }
            )
            if created:
                count += 1
                
        self.stdout.write(self.style.SUCCESS(f"Successfully initialized {count} CIP Basis TEMPLATE records (project=None)."))
