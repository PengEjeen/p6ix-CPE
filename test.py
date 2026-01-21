import requests
from datetime import date, datetime, timedelta
import calendar

SERVICE_KEY = "6bbb2c8e04a0114eb2cffa77e86dcf16f35b12155225001f824f3a6c4e425317"

BASE_URL = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"

START_YEAR = 2025
END_YEAR = 2034

# month -> [counts per year]
monthly_off_counts = {m: [] for m in range(1, 13)}

for year in range(START_YEAR, END_YEAR + 1):

    # 1) 해당 연도 공공기관 공휴일 날짜 수집
    public_holidays = set()

    for month in range(1, 13):
        url = (
            f"{BASE_URL}"
            f"?serviceKey={SERVICE_KEY}"
            f"&solYear={year}"
            f"&solMonth={month:02d}"
            f"&numOfRows=100"
            f"&pageNo=1"
            f"&_type=json"
        )

        r = requests.get(url)
        r.raise_for_status()
        data = r.json()

        body = data.get("response", {}).get("body", {})
        items = body.get("items")

        if not items or isinstance(items, str):
            continue

        item = items.get("item", [])
        if isinstance(item, dict):
            item_list = [item]
        elif isinstance(item, list):
            item_list = item
        else:
            item_list = []

        for it in item_list:
            if it.get("isHoliday") == "Y":
                d = datetime.strptime(str(it["locdate"]), "%Y%m%d").date()
                public_holidays.add(d)

    # 2) 월별로 (일요일 ∪ 공공휴일) 계산
    for month in range(1, 13):
        off_days = set()
        last_day = calendar.monthrange(year, month)[1]

        for day in range(1, last_day + 1):
            d = date(year, month, day)

            # 일요일
            if d.weekday() == 6:
                off_days.add(d)

            # 공공기관 공휴일
            if d in public_holidays:
                off_days.add(d)

        monthly_off_counts[month].append(len(off_days))

# 3) 평균 출력
years = END_YEAR - START_YEAR + 1
print(f"{START_YEAR}~{END_YEAR} ({years}년) 월별 쉬는 날 평균 (일요일 포함)")
print("월 | 평균 쉬는 날(일)")
print("-" * 30)

for month in range(1, 13):
    avg = sum(monthly_off_counts[month]) / len(monthly_off_counts[month])
    print(f"{month:02d} | {avg:6.2f}")