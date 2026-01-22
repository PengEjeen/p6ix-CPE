import os
import django
from datetime import date

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

from operatio.models import PublicHoliday

# 2025-2034년까지 근로자의 날 업데이트
for year in range(2025, 2035):
    labor_day = date(year, 5, 1)
    locdate = int(labor_day.strftime("%Y%m%d"))
    
    holiday, created = PublicHoliday.objects.update_or_create(
        date=labor_day,
        seq=1,
        defaults={
            "name": "근로자의 날",
            "date_kind": "01",
            "is_holiday": "Y",
            "is_private": True,  # 민간 공휴일
            "locdate": locdate,
        },
    )
    
    if created:
        print(f"✅ {year}년 근로자의 날 생성")
    else:
        print(f"🔄 {year}년 근로자의 날 업데이트")

print("\n완료! 근로자의 날 업데이트됨 (is_private=True)")
