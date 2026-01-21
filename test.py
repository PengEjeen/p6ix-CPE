import requests
from datetime import date, datetime, timedelta
import calendar

SERVICE_KEY = "6bbb2c8e04a0114eb2cffa77e86dcf16f35b12155225001f824f3a6c4e425317"

BASE_URL = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
YEAR = 2026

# 1) 공휴일(공공기관 휴일) 정보: 날짜 -> [휴일명들]
public_holiday_names = {}  # {date: set(names)}

for month in range(1, 13):
    url = (
        f"{BASE_URL}"
        f"?serviceKey={SERVICE_KEY}"
        f"&solYear={YEAR}"
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
        if it.get("isHoliday") != "Y":
            continue

        d = datetime.strptime(str(it["locdate"]), "%Y%m%d").date()
        name = (it.get("dateName") or "").strip()

        public_holiday_names.setdefault(d, set()).add(name)

# 2) 민간 전용 추가휴일 (대표: 근로자의날)
private_extra_names = {
    date(YEAR, 5, 1): {"근로자의 날"}
}

# 3) 날짜별 출력
start = date(YEAR, 1, 1)
end = date(YEAR, 12, 31)

def dow_kor(d: date) -> str:
    return "월화수목금토일"[d.weekday()]

cur = start
print("date,weekday,is_weekend,is_public_holiday,public_names,is_public_off,is_private_off,private_extra_names")
while cur <= end:
    is_weekend = cur.weekday() >= 5

    public_names = public_holiday_names.get(cur, set())
    is_public_holiday = len(public_names) > 0

    private_extra = private_extra_names.get(cur, set())

    is_public_off = is_weekend or is_public_holiday
    is_private_off = is_weekend or is_public_holiday or (len(private_extra) > 0)

    # 보기 좋게 문자열로
    public_names_str = "|".join(sorted(n for n in public_names if n))  # 여러 개면 |로 합침
    private_extra_str = "|".join(sorted(private_extra))

    print(
        f"{cur.isoformat()},"
        f"{dow_kor(cur)},"
        f"{int(is_weekend)},"
        f"{int(is_public_holiday)},"
        f"\"{public_names_str}\","
        f"{int(is_public_off)},"
        f"{int(is_private_off)},"
        f"\"{private_extra_str}\""
    )

    cur += timedelta(days=1)