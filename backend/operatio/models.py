from django.db import models


class WeatherStation(models.Model):
    station_id = models.IntegerField(unique=True, verbose_name="지점")
    name = models.CharField(max_length=100, verbose_name="지점명")

    class Meta:
        verbose_name = "지점"
        verbose_name_plural = "지점 목록"
        ordering = ["station_id"]

    def __str__(self):
        return f"{self.station_id} {self.name}"


class WeatherDailyRecord(models.Model):
    # 지점 번호 (stnId)
    station_id = models.IntegerField(verbose_name="지점")
    # 기준 일자 (YYYY-MM-DD)
    date = models.DateField(verbose_name="일자")
    # 시간/일시 (tm)
    tm = models.DateField(null=True, blank=True, verbose_name="tm")
    # 지점 번호 (API 원본)
    stnId = models.IntegerField(null=True, blank=True, verbose_name="stnId")
    # 지점명
    stnNm = models.CharField(max_length=100, null=True, blank=True, verbose_name="stnNm")
    # 평균 10cm 지중온도(°C)
    avgCm10Te = models.FloatField(null=True, blank=True, verbose_name="avgCm10Te")
    # 평균 20cm 지중온도(°C)
    avgCm20Te = models.FloatField(null=True, blank=True, verbose_name="avgCm20Te")
    # 평균 30cm 지중온도(°C)
    avgCm30Te = models.FloatField(null=True, blank=True, verbose_name="avgCm30Te")
    # 평균 5cm 지중온도(°C)
    avgCm5Te = models.FloatField(null=True, blank=True, verbose_name="avgCm5Te")
    # 평균 중하층운량(10분위)
    avgLmac = models.FloatField(null=True, blank=True, verbose_name="avgLmac")
    # 평균 0.5m 지중온도(°C)
    avgM05Te = models.FloatField(null=True, blank=True, verbose_name="avgM05Te")
    # 평균 1.0m 지중온도(°C)
    avgM10Te = models.FloatField(null=True, blank=True, verbose_name="avgM10Te")
    # 평균 1.5m 지중온도(°C)
    avgM15Te = models.FloatField(null=True, blank=True, verbose_name="avgM15Te")
    # 평균 3.0m 지중온도(°C)
    avgM30Te = models.FloatField(null=True, blank=True, verbose_name="avgM30Te")
    # 평균 5.0m 지중온도(°C)
    avgM50Te = models.FloatField(null=True, blank=True, verbose_name="avgM50Te")
    # 평균 현지기압(hPa)
    avgPa = models.FloatField(null=True, blank=True, verbose_name="avgPa")
    # 평균 해면기압(hPa)
    avgPs = models.FloatField(null=True, blank=True, verbose_name="avgPs")
    # 평균 증기압(hPa)
    avgPv = models.FloatField(null=True, blank=True, verbose_name="avgPv")
    # 평균 상대습도(%)
    avgRhm = models.FloatField(null=True, blank=True, verbose_name="avgRhm")
    # 평균 기온(°C)
    avgTa = models.FloatField(null=True, blank=True, verbose_name="avgTa")
    # 평균 전운량(10분위)
    avgTca = models.FloatField(null=True, blank=True, verbose_name="avgTca")
    # 평균 이슬점온도(°C)
    avgTd = models.FloatField(null=True, blank=True, verbose_name="avgTd")
    # 평균 지면온도(°C)
    avgTs = models.FloatField(null=True, blank=True, verbose_name="avgTs")
    # 평균 풍속(m/s)
    avgWs = models.FloatField(null=True, blank=True, verbose_name="avgWs")
    # 일 최심신적설(cm)
    ddMefs = models.FloatField(null=True, blank=True, verbose_name="ddMefs")
    # 일 최심신적설 시각(hhmi)
    ddMefsHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="ddMefsHrmt")
    # 일 최심적설(cm)
    ddMes = models.FloatField(null=True, blank=True, verbose_name="ddMes")
    # 일 최심적설 시각(hhmi)
    ddMesHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="ddMesHrmt")
    # 1시간 최다 일사량(MJ/m2)
    hr1MaxIcsr = models.FloatField(null=True, blank=True, verbose_name="hr1MaxIcsr")
    # 1시간 최다 일사 시각(hhmi)
    hr1MaxIcsrHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="hr1MaxIcsrHrmt")
    # 1시간 최다 강수량(mm)
    hr1MaxRn = models.FloatField(null=True, blank=True, verbose_name="hr1MaxRn")
    # 1시간 최다 강수량 시각(hhmi)
    hr1MaxRnHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="hr1MaxRnHrmt")
    # 풍정합(100m)
    hr24SumRws = models.FloatField(null=True, blank=True, verbose_name="hr24SumRws")
    # 일기현상
    iscs = models.FloatField(null=True, blank=True, verbose_name="iscs")
    # 최대 순간풍속(m/s)
    maxInsWs = models.FloatField(null=True, blank=True, verbose_name="maxInsWs")
    # 최대 순간풍속 시각(hhmi)
    maxInsWsHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="maxInsWsHrmt")
    # 최대 순간 풍속 풍향(16방위)
    maxInsWsWd = models.FloatField(null=True, blank=True, verbose_name="maxInsWsWd")
    # 최고 해면기압(hPa)
    maxPs = models.FloatField(null=True, blank=True, verbose_name="maxPs")
    # 최고 해면기압 시각(hhmi)
    maxPsHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="maxPsHrmt")
    # 최고 기온(°C)
    maxTa = models.FloatField(null=True, blank=True, verbose_name="maxTa")
    # 최고 기온 시각(hhmi)
    maxTaHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="maxTaHrmt")
    # 최다 풍향(16방위)
    maxWd = models.FloatField(null=True, blank=True, verbose_name="maxWd")
    # 최대 풍속(m/s)
    maxWs = models.FloatField(null=True, blank=True, verbose_name="maxWs")
    # 최대 풍속 시각(hhmi)
    maxWsHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="maxWsHrmt")
    # 최대 풍속 풍향(16방위)
    maxWsWd = models.FloatField(null=True, blank=True, verbose_name="maxWsWd")
    # 10분 최다강수량(mm)
    mi10MaxRn = models.FloatField(null=True, blank=True, verbose_name="mi10MaxRn")
    # 10분 최다강수량 시각(hhmi)
    mi10MaxRnHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="mi10MaxRnHrmt")
    # 최저 해면기압(hPa)
    minPs = models.FloatField(null=True, blank=True, verbose_name="minPs")
    # 최저 해면기압 시각(hhmi)
    minPsHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="minPsHrmt")
    # 최소 상대습도(%)
    minRhm = models.FloatField(null=True, blank=True, verbose_name="minRhm")
    # 최소 상대습도 시각(hhmi)
    minRhmHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="minRhmHrmt")
    # 최저 기온(°C)
    minTa = models.FloatField(null=True, blank=True, verbose_name="minTa")
    # 최저 기온 시각(hhmi)
    minTaHrmt = models.CharField(max_length=20, null=True, blank=True, verbose_name="minTaHrmt")
    # 최저 초상온도(°C)
    minTg = models.FloatField(null=True, blank=True, verbose_name="minTg")
    # 9-9강수(mm)
    n99Rn = models.FloatField(null=True, blank=True, verbose_name="n99Rn")
    # 가조시간(hr)
    ssDur = models.FloatField(null=True, blank=True, verbose_name="ssDur")
    # 합계 3시간 신적설(cm)
    sumDpthFhsc = models.FloatField(null=True, blank=True, verbose_name="sumDpthFhsc")
    # 안개 계속 시간(hr)
    sumFogDur = models.FloatField(null=True, blank=True, verbose_name="sumFogDur")
    # 합계 일사량(MJ/m2)
    sumGsr = models.FloatField(null=True, blank=True, verbose_name="sumGsr")
    # 합계 대형증발량(mm)
    sumLrgEv = models.FloatField(null=True, blank=True, verbose_name="sumLrgEv")
    # 일강수량(mm)
    sumRn = models.FloatField(null=True, blank=True, verbose_name="sumRn")
    # 강수 계속시간(hr)
    sumRnDur = models.FloatField(null=True, blank=True, verbose_name="sumRnDur")
    # 합계 소형증발량(mm)
    sumSmlEv = models.FloatField(null=True, blank=True, verbose_name="sumSmlEv")
    # 합계 일조 시간(hr)
    sumSsHr = models.FloatField(null=True, blank=True, verbose_name="sumSsHr")
    # 원본 응답 JSON
    payload = models.JSONField(verbose_name="원본 데이터")
    # 생성 시각
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="생성일")
    # 수정 시각
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일")

    class Meta:
        verbose_name = "일자료"
        verbose_name_plural = "일자료 목록"
        ordering = ["-date", "station_id"]
        constraints = [
            models.UniqueConstraint(fields=["station_id", "date"], name="uniq_weather_daily"),
        ]

    def __str__(self):
        return f"{self.station_id} {self.date}"


class PublicHoliday(models.Model):
    # 날짜 (YYYYMMDD 형식을 DateField로 저장)
    date = models.DateField(verbose_name="날짜", db_index=True)
    
    # 공휴일 이름 (예: '설날', '광복절', '대체공휴일')
    name = models.CharField(max_length=100, verbose_name="공휴일명")
    
    # 날짜 종류 (dateKind, 예: '01')
    date_kind = models.CharField(max_length=10, null=True, blank=True, verbose_name="날짜종류")
    
    # 공휴일 여부 ('Y' or 'N')
    is_holiday = models.CharField(max_length=1, default='Y', verbose_name="공휴일여부")
    
    # 민간 적용 여부 (True=민간 적용, False=공공만)
    is_private = models.BooleanField(default=False, verbose_name="민간적용")
    
    # 순서 (같은 날짜에 여러 공휴일이 있을 경우 구분)
    seq = models.IntegerField(default=1, verbose_name="순서")
    
    # 원본 locdate 값 (YYYYMMDD 정수형)
    locdate = models.IntegerField(verbose_name="원본날짜코드")
    
    # 생성 시각
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="생성일")
    
    # 수정 시각
    updated_at = models.DateTimeField(auto_now=True, verbose_name="수정일")

    class Meta:
        verbose_name = "공휴일"
        verbose_name_plural = "공휴일 목록"
        ordering = ["date", "seq"]
        constraints = [
            models.UniqueConstraint(
                fields=["date", "seq"], 
                name="uniq_public_holiday"
            ),
        ]

    def __str__(self):
        return f"{self.date} - {self.name}"
