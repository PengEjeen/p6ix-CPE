
import os
import django
import sys

sys.path.append('/home/pengejeen/p6ix-CPE/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from cpe_all_module.models import CIPProductivityBasis, CIPResult

project_id = 1 # Assuming project 1 based on context, or I should filter by all.

print(f"--- Data Counts ---")
basis_count = CIPProductivityBasis.objects.count()
result_count = CIPResult.objects.count()
print(f"Basis Count: {basis_count}")
print(f"Result Count: {result_count}")

print("\n--- Details ---")
for b in CIPProductivityBasis.objects.all():
    print(f"Basis ID: {b.id}, Project: {b.project_id}")

for r in CIPResult.objects.all():
    print(f"Result ID: {r.id}, Project: {r.project_id}, Dia: '{r.diameter_selection}'")

