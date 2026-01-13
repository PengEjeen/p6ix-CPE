from django.core.management.base import BaseCommand
from cpe_all_module.models.pile_productivity_models import PileStandard

class Command(BaseCommand):
    help = 'Initialize Pile Foundation Standard Data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Initializing Pile Foundation Standard Reference Data...")

        # Data definition based on "기성말뚝 기초 생산성 근거" sheet
        # structure: [PileType, DiameterSpec, {Clay, Sand, Weathered, SoftRock, HardRock, Mixed}]
        data = [
            # Auger Bit (오거비트)
            {
                "pile_type": "AUGER",
                "diameter_spec": "500미만",
                "values": {"clay": 0.74, "sand": 0.96, "weathered": 4.08}
            },
            {
                "pile_type": "AUGER",
                "diameter_spec": "500~600",
                "values": {"clay": 0.91, "sand": 1.18, "weathered": 4.99}
            },
            {
                "pile_type": "AUGER",
                "diameter_spec": "700~800",
                "values": {"clay": 1.24, "sand": 1.61, "weathered": 6.80}
            },
            
            # Improved Bit (개량형비트)
            {
                "pile_type": "IMPROVED",
                "diameter_spec": "500미만",
                "values": {"clay": 0.74, "sand": 0.96, "weathered": 3.80, "mixed": 3.28}
            },
            {
                "pile_type": "IMPROVED",
                "diameter_spec": "500~600",
                "values": {"clay": 0.91, "sand": 1.18, "weathered": 4.61, "mixed": 4.01}
            },
            {
                "pile_type": "IMPROVED",
                "diameter_spec": "700~800",
                "values": {"clay": 1.24, "sand": 1.61, "weathered": 6.32, "mixed": 5.46}
            },
            
            # Hammer Bit (해머비트)
            {
                "pile_type": "HAMMER",
                "diameter_spec": "500미만",
                "values": {"weathered": 3.66, "soft_rock": 8.56, "hard_rock": 11.93}
            },
            {
                "pile_type": "HAMMER",
                "diameter_spec": "500~600",
                "values": {"weathered": 4.48, "soft_rock": 10.48, "hard_rock": 14.61}
            },
            {
                "pile_type": "HAMMER",
                "diameter_spec": "700~800",
                "values": {"weathered": 6.12, "soft_rock": 14.32, "hard_rock": 19.96}
            }
        ]

        count = 0
        for item in data:
            vals = item["values"]
            obj, created = PileStandard.objects.update_or_create(
                pile_type=item["pile_type"],
                diameter_spec=item["diameter_spec"],
                defaults={
                    "value_clay": vals.get("clay"),
                    "value_sand": vals.get("sand"),
                    "value_weathered": vals.get("weathered"),
                    "value_soft_rock": vals.get("soft_rock"),
                    "value_hard_rock": vals.get("hard_rock"),
                    "value_mixed": vals.get("mixed"),
                }
            )
            if created:
                count += 1
        
        self.stdout.write(self.style.SUCCESS(f"Successfully initialized {count} Pile Standard records."))
