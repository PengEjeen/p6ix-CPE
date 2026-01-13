
import os
import django
import sys

sys.path.append('/home/pengejeen/p6ix-CPE/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from cpe_all_module.models import CIPDrillingStandard

print("--- CIP Drilling Standards Dump ---")
for s in CIPDrillingStandard.objects.all():
    print(f"ID: {s.id} | Bit: '{s.bit_type}' | Dia: '{s.diameter_spec}' | Clay: {s.value_clay}")
    
print("\n--- Testing Lookup ---")
# Mimic frontend lookup logic
dia = "500미만"
bit = "AUGER"
match = CIPDrillingStandard.objects.filter(diameter_spec=dia, bit_type=bit).first()
if match:
    print(f"Match Found! Clay Value: {match.value_clay}")
else:
    print(f"No Match for {dia} / {bit}")