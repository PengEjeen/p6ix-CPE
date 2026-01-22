import os
import requests

SERVICE_KEY = "6bbb2c8e04a0114eb2cffa77e86dcf16f35b12155225001f824f3a6c4e425317"
if not SERVICE_KEY:
    raise SystemExit("WEATHER_API_KEY 환경변수가 필요합니다.")

URL = "http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"

params = {
    "serviceKey": SERVICE_KEY,
    "pageNo": 1,
    "numOfRows": 5,
    "dataType": "JSON",
    "dataCd": "ASOS",
    "dateCd": "DAY",
    "startDt": "20150101",
    "endDt": "20170101",
    "stnIds": "108",
}

response = requests.get(URL, params=params, timeout=30)
response.raise_for_status()
data = response.json()
items = data.get("response", {}).get("body", {}).get("items", {}).get("item", [])

print(data)
