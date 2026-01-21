from django.contrib import admin
from .models import WeatherStation, WeatherDailyRecord


@admin.register(WeatherStation)
class WeatherStationAdmin(admin.ModelAdmin):
    list_display = ["station_id", "name"]
    list_display_links = ["station_id", "name"]
    search_fields = ["station_id", "name"]
    ordering = ["station_id"]


@admin.register(WeatherDailyRecord)
class WeatherDailyRecordAdmin(admin.ModelAdmin):
    list_display = [
        "date",
        "station_id",
        "stnNm",
        "avgTa",
        "maxTa",
        "minTa",
        "sumRn",
        "avgRhm",
        "avgWs",
    ]
    list_display_links = ["date", "station_id"]
    list_filter = ["station_id", "date"]
    search_fields = ["station_id", "stnNm", "date"]
    date_hierarchy = "date"
    ordering = ["-date", "station_id"]
    
    fieldsets = (
        (
            "기본 정보",
            {
                "fields": (
                    "station_id",
                    "stnNm",
                    "date",
                    "tm",
                )
            },
        ),
        (
            "기온",
            {
                "fields": (
                    "avgTa",
                    "maxTa",
                    "maxTaHrmt",
                    "minTa",
                    "minTaHrmt",
                    "avgTd",
                    "avgTs",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "지중 온도",
            {
                "fields": (
                    "avgCm5Te",
                    "avgCm10Te",
                    "avgCm20Te",
                    "avgCm30Te",
                    "avgM05Te",
                    "avgM10Te",
                    "avgM15Te",
                    "avgM30Te",
                    "avgM50Te",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "습도",
            {
                "fields": (
                    "avgRhm",
                    "minRhm",
                    "minRhmHrmt",
                    "avgPv",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "강수",
            {
                "fields": (
                    "sumRn",
                    "hr1MaxRn",
                    "hr1MaxRnHrmt",
                    "mi10MaxRn",
                    "mi10MaxRnHrmt",
                    "sumRnDur",
                    "n99Rn",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "풍속/풍향",
            {
                "fields": (
                    "avgWs",
                    "maxWs",
                    "maxWsHrmt",
                    "maxWsWd",
                    "maxInsWs",
                    "maxInsWsHrmt",
                    "maxInsWsWd",
                    "maxWd",
                    "hr24SumRws",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "기압",
            {
                "fields": (
                    "avgPa",
                    "avgPs",
                    "maxPs",
                    "maxPsHrmt",
                    "minPs",
                    "minPsHrmt",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "일사/일조",
            {
                "fields": (
                    "sumGsr",
                    "hr1MaxIcsr",
                    "hr1MaxIcsrHrmt",
                    "sumSsHr",
                    "ssDur",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "운량/적설",
            {
                "fields": (
                    "avgTca",
                    "avgLmac",
                    "ddMefs",
                    "ddMefsHrmt",
                    "ddMes",
                    "ddMesHrmt",
                    "sumDpthFhsc",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "기타",
            {
                "fields": (
                    "iscs",
                    "minTg",
                    "sumFogDur",
                    "sumLrgEv",
                    "sumSmlEv",
                ),
                "classes": ["collapse"],
            },
        ),
        (
            "원본 데이터",
            {
                "fields": ("payload",),
                "classes": ["collapse"],
            },
        ),
        (
            "시스템",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                ),
                "classes": ["collapse"],
            },
        ),
    )
    
    readonly_fields = ["created_at", "updated_at"]
    
    # 레코드 수가 많을 수 있으므로 페이지당 표시 수 설정
    list_per_page = 50
