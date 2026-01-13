from django.core.management.base import BaseCommand
from cpe_all_module.models.cip_productivity_models import CIPDrillingStandard

class Command(BaseCommand):
    help = 'Initialize CIP Drilling Standard Data'

    def handle(self, *args, **kwargs):
        self.stdout.write("Initializing CIP Drilling Standard Reference Data...")

        # Data definition based on the image provided
        # structure: [BitType, DiameterSpec, {Clay, Sand, Weathered, SoftRock, HardRock, Mixed}]
        data = [
            # Auger Bit
            {
                "bit_type": "AUGER",
                "diameter_spec": "500미만",
                "values": {"clay": 0.74, "sand": 0.96, "weathered": 4.08}
            },
            {
                "bit_type": "AUGER",
                "diameter_spec": "500이상",
                "values": {"clay": 0.91, "sand": 1.18, "weathered": 4.99}
            },
            
            # Improved Bit
            {
                "bit_type": "IMPROVED",
                "diameter_spec": "500미만",
                "values": {"clay": 0.74, "sand": 0.96, "weathered": 3.8, "mixed": 3.28}
            },
            {
                "bit_type": "IMPROVED",
                "diameter_spec": "500~600",
                "values": {"clay": 0.91, "sand": 1.18, "weathered": 4.61, "mixed": 4.01}
            },
            
            # Hammer Bit
            {
                "bit_type": "HAMMER",
                "diameter_spec": "500미만",
                "values": {"weathered": 3.66, "soft_rock": 8.56, "hard_rock": 11.93}
            },
            {
                "bit_type": "HAMMER",
                "diameter_spec": "500~600",
                "values": {"weathered": 4.48, "soft_rock": 10.48, "hard_rock": 14.61}
            }
        ]

        count = 0
        for item in data:
            vals = item["values"]
            obj, created = CIPDrillingStandard.objects.update_or_create(
                bit_type=item["bit_type"],
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
        
        self.stdout.write(self.style.SUCCESS(f"Successfully initialized {count} CIP standard records."))
