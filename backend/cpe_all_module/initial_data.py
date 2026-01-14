def get_default_schedule_data():
    """
    공사 일정 기본 템플릿 데이터
    프로젝트 생성 시 자동으로 초기화되는 표준 공정표
    """
    return [
        # 1. 공사준비
        {"id": "init-1", "main_category": "1. 공사준비", "process": "공사시설", "work_type": "가설사무소", "operating_rate_type": "EARTH", "order": 0, "quantity": 1, "productivity": 1, "crew_size": 1, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "init-2", "main_category": "1. 공사준비", "process": "공사시설", "work_type": "가설도로", "operating_rate_type": "EARTH", "order": 1, "quantity": 100, "productivity": 20, "crew_size": 1, "unit": "m", "working_days": 0, "calendar_days": 0},
        {"id": "init-3", "main_category": "1. 공사준비", "process": "공동가설", "work_type": "가시설 계획품", "operating_rate_type": "EARTH", "order": 2, "quantity": 1, "productivity": 1, "crew_size": 1, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "init-4", "main_category": "1. 공사준비", "process": "공동가설", "work_type": "시설물 조치공사", "operating_rate_type": "EARTH", "order": 3, "quantity": 1, "productivity": 0.5, "crew_size": 1, "unit": "식", "working_days": 0, "calendar_days": 0},
        
        # 2. 토공사
        {"id": "earth-1", "main_category": "2. 토공사", "process": "흙파기", "work_type": "터파기", "operating_rate_type": "EARTH", "order": 4, "quantity": 10000, "productivity": 500, "crew_size": 2, "unit": "m³", "working_days": 0, "calendar_days": 0},
        {"id": "earth-2", "main_category": "2. 토공사", "process": "흙파기", "work_type": "되메우기", "operating_rate_type": "EARTH", "order": 5, "quantity": 3000, "productivity": 300, "crew_size": 1, "unit": "m³", "working_days": 0, "calendar_days": 0},
        {"id": "earth-3", "main_category": "2. 토공사", "process": "기타", "work_type": "토사운반", "operating_rate_type": "EARTH", "order": 6, "quantity": 7000, "productivity": 400, "crew_size": 1, "unit": "m³", "working_days": 0, "calendar_days": 0},
        
        # 3. 골조공사
        {"id": "frame-1", "main_category": "3. 골조공사", "process": "기초공사", "work_type": "잠재 콘크리트", "operating_rate_type": "FRAME", "order": 7, "quantity": 500, "productivity": 100, "crew_size": 2, "unit": "m³", "working_days": 0, "calendar_days": 0},
        {"id": "frame-2", "main_category": "3. 골조공사", "process": "기초공사", "work_type": "기초 거푸집", "operating_rate_type": "FRAME", "order": 8, "quantity": 2000, "productivity": 50, "crew_size": 3, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "frame-3", "main_category": "3. 골조공사", "process": "기초공사", "work_type": "기초 철근", "operating_rate_type": "FRAME", "order": 9, "quantity": 100, "productivity": 2, "crew_size": 4, "unit": "ton", "working_days": 0, "calendar_days": 0},
        {"id": "frame-4", "main_category": "3. 골조공사", "process": "기초공사", "work_type": "기초 콘크리트", "operating_rate_type": "FRAME", "order": 10, "quantity": 800, "productivity": 150, "crew_size": 2, "unit": "m³", "working_days": 0, "calendar_days": 0},
        {"id": "frame-5", "main_category": "3. 골조공사", "process": "지하층", "work_type": "지하 거푸집", "operating_rate_type": "FRAME", "order": 11, "quantity": 5000, "productivity": 60, "crew_size": 5, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "frame-6", "main_category": "3. 골조공사", "process": "지하층", "work_type": "지하 철근", "operating_rate_type": "FRAME", "order": 12, "quantity": 250, "productivity": 2.5, "crew_size": 6, "unit": "ton", "working_days": 0, "calendar_days": 0},
        {"id": "frame-7", "main_category": "3. 골조공사", "process": "지하층", "work_type": "지하 콘크리트", "operating_rate_type": "FRAME", "order": 13, "quantity": 2000, "productivity": 200, "crew_size": 3, "unit": "m³", "working_days": 0, "calendar_days": 0},
        {"id": "frame-8", "main_category": "3. 골조공사", "process": "지상층", "work_type": "지상 거푸집", "operating_rate_type": "FRAME", "order": 14, "quantity": 15000, "productivity": 80, "crew_size": 8, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "frame-9", "main_category": "3. 골조공사", "process": "지상층", "work_type": "지상 철근", "operating_rate_type": "FRAME", "order": 15, "quantity": 600, "productivity": 3, "crew_size": 10, "unit": "ton", "working_days": 0, "calendar_days": 0},
        {"id": "frame-10", "main_category": "3. 골조공사", "process": "지상층", "work_type": "지상 콘크리트", "operating_rate_type": "FRAME", "order": 16, "quantity": 6000, "productivity": 250, "crew_size": 4, "unit": "m³", "working_days": 0, "calendar_days": 0},
        
        # 4. 마감공사
        {"id": "finish-1", "main_category": "4. 마감공사", "process": "외부마감", "work_type": "외벽마감 계획품", "operating_rate_type": "EXT_FIN", "order": 17, "quantity": 1, "productivity": 1, "crew_size": 1, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "finish-2", "main_category": "4. 마감공사", "process": "외부마감", "work_type": "외벽 석재", "operating_rate_type": "EXT_FIN", "order": 18, "quantity": 3000, "productivity": 25, "crew_size": 4, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "finish-3", "main_category": "4. 마감공사", "process": "외부마감", "work_type": "창호공사", "operating_rate_type": "EXT_FIN", "order": 19, "quantity": 1500, "productivity": 20, "crew_size": 3, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "finish-4", "main_category": "4. 마감공사", "process": "내부마감", "work_type": "미장공사", "operating_rate_type": "INT_FIN", "order": 20, "quantity": 10000, "productivity": 40, "crew_size": 5, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "finish-5", "main_category": "4. 마감공사", "process": "내부마감", "work_type": "도배공사", "operating_rate_type": "INT_FIN", "order": 21, "quantity": 8000, "productivity": 50, "crew_size": 4, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "finish-6", "main_category": "4. 마감공사", "process": "내부마감", "work_type": "타일공사", "operating_rate_type": "INT_FIN", "order": 22, "quantity": 4000, "productivity": 30, "crew_size": 4, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "finish-7", "main_category": "4. 마감공사", "process": "내부마감", "work_type": "바닥공사", "operating_rate_type": "INT_FIN", "order": 23, "quantity": 12000, "productivity": 60, "crew_size": 5, "unit": "m²", "working_days": 0, "calendar_days": 0},
        
        # 5. 기계/전기/MEP
        {"id": "mep-1", "main_category": "5. 기계/전기/MEP", "process": "위생설비", "work_type": "급수설비", "operating_rate_type": "INT_FIN", "order": 24, "quantity": 1, "productivity": 1, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "mep-2", "main_category": "5. 기계/전기/MEP", "process": "위생설비", "work_type": "배수설비", "operating_rate_type": "INT_FIN", "order": 25, "quantity": 1, "productivity": 1, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "mep-3", "main_category": "5. 기계/전기/MEP", "process": "공조설비", "work_type": "냉난방공사", "operating_rate_type": "INT_FIN", "order": 26, "quantity": 1, "productivity": 0.8, "crew_size": 3, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "mep-4", "main_category": "5. 기계/전기/MEP", "process": "전기설비", "work_type": "전기간선", "operating_rate_type": "INT_FIN", "order": 27, "quantity": 1, "productivity": 1, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "mep-5", "main_category": "5. 기계/전기/MEP", "process": "전기설비", "work_type": "조명설비", "operating_rate_type": "INT_FIN", "order": 28, "quantity": 1, "productivity": 1, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "mep-6", "main_category": "5. 기계/전기/MEP", "process": "소방설비", "work_type": "소화설비", "operating_rate_type": "INT_FIN", "order": 29, "quantity": 1, "productivity": 1, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "mep-7", "main_category": "5. 기계/전기/MEP", "process": "통신설비", "work_type": "약전설비", "operating_rate_type": "INT_FIN", "order": 30, "quantity": 1, "productivity": 1, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
        
        # 6. 내부마감 및 조경
        {"id": "land-1", "main_category": "6. 내부마감 및 조경", "process": "조경", "work_type": "식재공사", "operating_rate_type": "EARTH", "order": 31, "quantity": 1, "productivity": 1, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "land-2", "main_category": "6. 내부마감 및 조경", "process": "조경", "work_type": "포장공사", "operating_rate_type": "EARTH", "order": 32, "quantity": 500, "productivity": 50, "crew_size": 2, "unit": "m²", "working_days": 0, "calendar_days": 0},
        {"id": "land-3", "main_category": "6. 내부마감 및 조경", "process": "부대토목", "work_type": "옹벽공사", "operating_rate_type": "EARTH", "order": 33, "quantity": 200, "productivity": 20, "crew_size": 2, "unit": "m²", "working_days": 0, "calendar_days": 0},
        
        # 7. 정리기간
        {"id": "final-1", "main_category": "7. 정리기간", "process": "준공준비", "work_type": "정리정돈", "operating_rate_type": "INT_FIN", "order": 34, "quantity": 1, "productivity": 1, "crew_size": 3, "unit": "식", "working_days": 0, "calendar_days": 0},
        {"id": "final-2", "main_category": "7. 정리기간", "process": "준공준비", "work_type": "검사준비", "operating_rate_type": "INT_FIN", "order": 35, "quantity": 1, "productivity": 0.5, "crew_size": 2, "unit": "식", "working_days": 0, "calendar_days": 0},
    ]
