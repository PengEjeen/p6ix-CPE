from django.core.management.base import BaseCommand
from cpe_all_module.models import BoredPileProductivityBasis

class Command(BaseCommand):
    help = 'Initialize Tired Pile Productivity Basis template data'

    def handle(self, *args, **options):
        # Create default rows for Bored Pile productivity calculation
        # These are used as templates for projects.
        
        templates = [
            {"description": "점질토 굴착", "method": "OSCILLATOR", "pile_diameter": 1000, "layer": "clay"},
            {"description": "사질토 굴착", "method": "OSCILLATOR", "pile_diameter": 1000, "layer": "sand"},
            {"description": "자갈 굴착", "method": "OSCILLATOR", "pile_diameter": 1000, "layer": "gravel"},
            {"description": "풍화암 굴착 (RCD)", "method": "RCD", "pile_diameter": 1000, "layer": "weathered"},
            {"description": "풍화암 굴착 (전회전)", "method": "ALL_CASING", "pile_diameter": 1000, "layer": "weathered"},
            {"description": "연암 굴착 (RCD)", "method": "RCD", "pile_diameter": 1000, "layer": "soft_rock"},
            {"description": "연암 굴착 (전회전)", "method": "ALL_CASING", "pile_diameter": 1000, "layer": "soft_rock"},
            {"description": "경암 굴착 (RCD)", "method": "RCD", "pile_diameter": 1000, "layer": "hard_rock"},
            {"description": "경암 굴착 (전회전)", "method": "ALL_CASING", "pile_diameter": 1000, "layer": "hard_rock"},
        ]

        # Only create if empty or for seeding purpose
        # Here we usually keep them with project=None as templates
        BoredPileProductivityBasis.objects.filter(project=None).delete()
        
        for t in templates:
            basis = BoredPileProductivityBasis.objects.create(
                project=None,
                description=t["description"],
                method=t["method"],
                pile_diameter=t["pile_diameter"],
                t1=2.0,
                classification_factor=0.85
            )
            # Add default 20m for the relevant layer to match Excel
            if "layer" in t:
                setattr(basis, f"layer_depth_{t['layer']}", 20.0)
                basis.save()

        self.stdout.write(self.style.SUCCESS(f'Successfully initialized {len(templates)} Bored Pile basis templates.'))
