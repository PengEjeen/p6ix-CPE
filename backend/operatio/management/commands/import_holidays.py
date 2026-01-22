import requests
import holidays
from datetime import datetime
from django.core.management.base import BaseCommand
from operatio.models import PublicHoliday


def is_private_holiday(name, date_obj):
    """
    공휴일 이름과 날짜로 민간 적용 여부 판단
    
    민간 공휴일 (is_private=True):
    - 신정 (1/1)
    - 설날 연휴 (전날, 당일, 다음날) - 대체공휴일 제외
    - 근로자의 날 (5/1)
    - 추석 연휴 (전날, 당일, 다음날) - 대체공휴일 제외
    - 크리스마스 (12/25)
    
    Returns:
        True: 민간 적용 (공공+민간)
        False: 공공만
    """
    # 대체공휴일은 무조건 공공만
    if '대체' in name:
        return False
    
    # 신정 (1/1)
    if date_obj.month == 1 and date_obj.day == 1:
        return True
    
    # 설날 관련
    if '설날' in name:
        return True
    
    # 근로자의 날 (5/1)
    if name == '근로자의 날' or (date_obj.month == 5 and date_obj.day == 1):
        return True
    
    # 추석 관련
    if '추석' in name:
        return True
    
    # 크리스마스 (12/25)
    if ('크리스마스' in name or '기독탄신일' in name) and date_obj.month == 12 and date_obj.day == 25:
        return True
    
    # 그 외는 공공만
    return False


class Command(BaseCommand):
    help = "공공데이터포털 API에서 공휴일 데이터를 가져와 DB에 저장합니다 (API 없는 연도는 holidays 라이브러리 사용)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--start-year",
            type=int,
            default=2025,
            help="시작 연도 (기본값: 2025)",
        )
        parser.add_argument(
            "--end-year",
            type=int,
            default=2034,
            help="종료 연도 (기본값: 2034)",
        )
        parser.add_argument(
            "--service-key",
            type=str,
            default="6bbb2c8e04a0114eb2cffa77e86dcf16f35b12155225001f824f3a6c4e425317",
            help="공공데이터포털 서비스 키",
        )
        parser.add_argument(
            "--use-library",
            action="store_true",
            help="API 대신 holidays 라이브러리만 사용",
        )

    def handle(self, *args, **options):
        start_year = options["start_year"]
        end_year = options["end_year"]
        service_key = options["service_key"]
        use_library_only = options["use_library"]

        base_url = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"

        total_saved = 0
        total_updated = 0

        self.stdout.write(
            self.style.SUCCESS(
                f"공휴일 데이터 수집 시작: {start_year}년 ~ {end_year}년"
            )
        )

        for year in range(start_year, end_year + 1):
            year_saved = 0
            year_updated = 0
            api_has_data = False

            # API에서 데이터 시도 (use_library_only가 False일 때만)
            if not use_library_only:
                for month in range(1, 13):
                    url = (
                        f"{base_url}"
                        f"?serviceKey={service_key}"
                        f"&solYear={year}"
                        f"&solMonth={month:02d}"
                        f"&numOfRows=100"
                        f"&pageNo=1"
                        f"&_type=json"
                    )

                    try:
                        response = requests.get(url, timeout=10)
                        response.raise_for_status()
                        data = response.json()

                        body = data.get("response", {}).get("body", {})
                        items = body.get("items")

                        if not items or isinstance(items, str):
                            continue

                        item = items.get("item", [])
                        
                        # item이 dict면 리스트로 변환
                        if isinstance(item, dict):
                            item_list = [item]
                        elif isinstance(item, list):
                            item_list = item
                        else:
                            item_list = []

                        for it in item_list:
                            if it.get("isHoliday") == "Y":
                                api_has_data = True
                                locdate = it["locdate"]
                                date_obj = datetime.strptime(str(locdate), "%Y%m%d").date()

                                holiday_name = it.get("dateName", "")
                                is_priv = is_private_holiday(holiday_name, date_obj)
                                
                                holiday, created = PublicHoliday.objects.update_or_create(
                                    date=date_obj,
                                    seq=it.get("seq", 1),
                                    defaults={
                                        "name": holiday_name,
                                        "date_kind": it.get("dateKind", "01"),
                                        "is_holiday": it.get("isHoliday", "Y"),
                                        "is_private": is_priv,
                                        "locdate": locdate,
                                    },
                                )

                                if created:
                                    year_saved += 1
                                else:
                                    year_updated += 1

                    except requests.RequestException as e:
                        self.stdout.write(
                            self.style.WARNING(
                                f"{year}년 {month}월 API 호출 실패: {str(e)}"
                            )
                        )
                        continue

            # API에 데이터가 없으면 holidays 라이브러리 사용
            if not api_has_data or use_library_only:
                self.stdout.write(
                    self.style.WARNING(
                        f"{year}년: API 데이터 없음. holidays 라이브러리 사용"
                    )
                )
                
                kr_holidays = holidays.KR(years=year)
                for holiday_date, holiday_name in kr_holidays.items():
                    # seq는 같은 날짜에 여러 공휴일이 있을 경우를 대비
                    # holidays 라이브러리는 세미콜론으로 구분하므로 split
                    names = [n.strip() for n in holiday_name.split(';')]
                    
                    for seq, name in enumerate(names, start=1):
                        locdate = int(holiday_date.strftime("%Y%m%d"))
                        is_priv = is_private_holiday(name, holiday_date)
                        
                        holiday, created = PublicHoliday.objects.update_or_create(
                            date=holiday_date,
                            seq=seq,
                            defaults={
                                "name": name,
                                "date_kind": "01",
                                "is_holiday": "Y",
                                "is_private": is_priv,
                                "locdate": locdate,
                            },
                        )
                        
                        if created:
                            year_saved += 1
                        else:
                            year_updated += 1

            total_saved += year_saved
            total_updated += year_updated

            self.stdout.write(
                f"{year}년: {year_saved}개 신규 저장, {year_updated}개 업데이트"
            )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n완료! 총 {total_saved}개 신규 저장, {total_updated}개 업데이트"
            )
        )