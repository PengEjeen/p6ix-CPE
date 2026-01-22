import os
from datetime import date, datetime, timedelta

import requests
from django.core.management.base import BaseCommand

from operatio.models import WeatherDailyRecord, WeatherStation


class Command(BaseCommand):
    help = "Import KMA ASOS daily data and store full payloads."

    def add_arguments(self, parser):
        parser.add_argument("--service-key", default=None, help="Service key for data.go.kr")
        parser.add_argument("--start", default="20150101", help="Start date (YYYYMMDD)")
        parser.add_argument("--end", default=None, help="End date (YYYYMMDD). Defaults to today.")
        parser.add_argument("--station-ids", default=None, help="Comma-separated station ids")

    def handle(self, *args, **options):
        service_key = (
            options.get("service_key")
            or os.getenv("WEATHER_API_KEY")
            or os.getenv("WEATHER_SERVICE_KEY")
            or os.getenv("DATA_GO_KR_SERVICE_KEY")
        )
        if not service_key:
            self.stderr.write(self.style.ERROR("Missing service key. Use --service-key or env WEATHER_API_KEY."))
            return

        start = options["start"]
        end = options["end"] or date.today().strftime("%Y%m%d")
        try:
            end_date = datetime.strptime(end, "%Y%m%d").date()
        except ValueError:
            end_date = date.today()
        max_end_date = date.today() - timedelta(days=1)
        if end_date > max_end_date:
            self.stdout.write(
                self.style.WARNING(
                    f"End date {end_date} exceeds latest available date {max_end_date}. Capping end date."
                )
            )
            end_date = max_end_date
            end = end_date.strftime("%Y%m%d")
        station_ids_arg = options["station_ids"]

        if station_ids_arg:
            station_ids = [s.strip() for s in station_ids_arg.split(",") if s.strip()]
        else:
            station_ids = list(WeatherStation.objects.values_list("station_id", flat=True))

        if not station_ids:
            self.stderr.write(self.style.ERROR("No station ids available. Provide --station-ids or import stations first."))
            return

        url = "http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
        created = 0
        updated = 0

        time_fields = {
            "ddMefsHrmt",
            "ddMesHrmt",
            "hr1MaxIcsrHrmt",
            "hr1MaxRnHrmt",
            "maxInsWsHrmt",
            "maxPsHrmt",
            "maxTaHrmt",
            "maxWsHrmt",
            "mi10MaxRnHrmt",
            "minPsHrmt",
            "minRhmHrmt",
            "minTaHrmt",
        }

        def to_float(value):
            if value is None:
                return None
            text = str(value).strip()
            if text == "":
                return None
            try:
                return float(text)
            except ValueError:
                return None

        for station_id in station_ids:
            page = 1
            total_count = None

            while True:
                params = {
                    "serviceKey": service_key,
                    "pageNo": page,
                    "numOfRows": 999,
                    "dataType": "JSON",
                    "dataCd": "ASOS",
                    "dateCd": "DAY",
                    "startDt": start,
                    "endDt": end,
                    "stnIds": str(station_id),
                }
                response = requests.get(url, params=params, timeout=30)
                response.raise_for_status()
                payload = response.json()
                header = payload.get("response", {}).get("header", {})
                result_code = header.get("resultCode")
                result_msg = header.get("resultMsg")
                if result_code and result_code != "00":
                    self.stderr.write(
                        self.style.ERROR(
                            f"Station {station_id}: API error {result_code} {result_msg}"
                        )
                    )
                    break
                body = payload.get("response", {}).get("body", {})
                items = body.get("items", {}).get("item", [])
                if isinstance(items, dict):
                    items = [items]
                if total_count is None:
                    total_count = int(body.get("totalCount") or 0)

                if not items:
                    if total_count and page == 1:
                        self.stderr.write(
                            self.style.WARNING(
                                f"Station {station_id}: totalCount={total_count} but no items returned."
                            )
                        )
                    break

                for item in items:
                    stn_id = item.get("stnId") or station_id
                    tm = item.get("tm")
                    if not tm:
                        continue
                    if len(tm) == 8 and tm.isdigit():
                        tm_date = datetime.strptime(tm, "%Y%m%d").date()
                    else:
                        tm_date = datetime.strptime(tm, "%Y-%m-%d").date()

                    defaults = {
                        "payload": item,
                        "tm": tm_date,
                        "stnId": int(stn_id),
                        "stnNm": item.get("stnNm"),
                    }

                    for key, value in item.items():
                        if key in ("tm", "stnId", "stnNm"):
                            continue
                        if key in time_fields:
                            defaults[key] = str(value).strip() if value is not None else None
                        else:
                            defaults[key] = to_float(value)

                    obj, is_created = WeatherDailyRecord.objects.update_or_create(
                        station_id=int(stn_id),
                        date=tm_date,
                        defaults=defaults,
                    )
                    if is_created:
                        created += 1
                    else:
                        updated += 1

                if total_count is not None:
                    max_pages = (total_count + 998) // 999
                    if page >= max_pages:
                        break

                page += 1

            self.stdout.write(self.style.SUCCESS(f"Station {station_id}: done"))

        self.stdout.write(
            self.style.SUCCESS(f"Import finished. created={created} updated={updated}")
        )
