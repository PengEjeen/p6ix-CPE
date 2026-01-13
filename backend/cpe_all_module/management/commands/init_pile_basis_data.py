from django.core.management.base import BaseCommand
from cpe_all_module.models.pile_productivity_models import PileProductivityBasis

class Command(BaseCommand):
    help = 'Initialize Pile Productivity Basis Template Data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Initializing Pile Productivity Basis Data...")

        # Initialize Standard Template Data (project=None)
        common = {
            "project": None,
            "t1": 5.0,
            "pile_diameter": 500,
            "t3": 8.0,
            "grouting_length": 12.0,
            "t4": 4.0,
            "t5": 18.0,
            "classification_factor": 0.85
        }

        # Rows derived from Excel "기성말뚝 기초 생산성 근거" sheet templates
        rows = [
            {
                "description": "기성말뚝 Standard (점질토 12m/직경500)",
                "clay": 12.0, "sand": 0, "weathered": 0, "soft": 0, "hard": 0, "mixed": 0,
                "t2": 10.92, "cycle_time": 54.02, "daily": 8.89
            },
            {
                "description": "기성말뚝 Standard (사질토 12m/직경500)",
                "clay": 0, "sand": 12.0, "weathered": 0, "soft": 0, "hard": 0, "mixed": 0,
                "t2": 14.16, "cycle_time": 57.84, "daily": 8.30
            },
            {
                "description": "기성말뚝 Standard (풍화암 12m/직경500)",
                "clay": 0, "sand": 0, "weathered": 12.0, "soft": 0, "hard": 0, "mixed": 0,
                "t2": 55.32, "cycle_time": 106.26, "daily": 4.52
            },
            {
                "description": "기성말뚝 Standard (연암 12m/직경500)",
                "clay": 0, "sand": 0, "weathered": 0, "soft": 12.0, "hard": 0, "mixed": 0,
                "t2": 125.76, "cycle_time": 189.13, "daily": 2.54
            },
            {
                "description": "기성말뚝 Standard (경암 12m/직경500)",
                "clay": 0, "sand": 0, "weathered": 0, "soft": 0, "hard": 12.0, "mixed": 0,
                "t2": 175.32, "cycle_time": 247.44, "daily": 1.94
            },
            {
                "description": "기성말뚝 Standard (혼합층 12m/직경500)",
                "clay": 0, "sand": 0, "weathered": 0, "soft": 0, "hard": 0, "mixed": 12.0,
                "t2": 48.12, "cycle_time": 97.79, "daily": 4.91
            },
        ]

        count = 0
        for r in rows:
            obj, created = PileProductivityBasis.objects.update_or_create(
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
                
        self.stdout.write(self.style.SUCCESS(f"Successfully initialized {count} Pile Basis TEMPLATE records (project=None)."))
