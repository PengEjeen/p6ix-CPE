import requests
import xml.etree.ElementTree as ET
from datetime import datetime

SERVICE_KEY = "6bbb2c8e04a0114eb2cffa77e86dcf16f35b12155225001f824f3a6c4e425317"

BASE_URL = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"

for month in range(1, 13):
    url = (
        f"{BASE_URL}"
        f"?serviceKey={SERVICE_KEY}"
        f"&solYear=2026"
        f"&solMonth={month:02d}"
        f"&numOfRows=100"
        f"&pageNo=1"
    )

    response = requests.get(url)
    response.raise_for_status()
    print(response.text)
    root = ET.fromstring(response.text)

    for item in root.iter("item"):
        if item.findtext("isHoliday") == "Y":
            date = datetime.strptime(
                item.findtext("locdate"), "%Y%m%d"
            ).date()
            name = item.findtext("dateName")

            print(date, name)