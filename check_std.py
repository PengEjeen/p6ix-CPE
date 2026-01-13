
import os
import django
import sys

sys.path.append('/home/pengejeen/p6ix-CPE/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from cpe_all_module.models.cip_productivity_models import CIPDrillingStandard

count = CIPDrillingStandard.objects.count()
print(f"Standard Count: {count}")
if count > 0:
    first = CIPDrillingStandard.objects.first()
    print(f"Sample: {first.bit_type} - {first.diameter_spec}")
    print(f"Clay: {first.value_clay}, Sand: {first.value_sand}")
