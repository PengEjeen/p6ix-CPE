"""
Construction Schedule Item Serializer

데이터 구조 (data 필드 - JSONField):
[
    {
        # === 기본 정보 ===
        "id": "earth-1",                      # str: 고유 ID
        "main_category": "토공사",            # str: 대공종
        "process": "토사운반",                # str: 공정/공법
        "work_type": "토사운반",              # str: 세부 작업 유형
        
        # === 수량 ===
        "quantity": 1000,                     # float: 수량
        "quantity_formula": "100*10",         # str: 수량 계산식 (optional)
        "unit": "m³",                         # str: 단위
        
        # === 생산성 ===
        "productivity": 50,                   # float: 생산성 (1인당 1일 작업량)
        "crew_size": 5,                       # int: 투입 인원
        "daily_production": 250,              # float: 일일 생산량 (계산값)
        
        # === 기간 계산 ===
        "working_days": 4.0,                  # float: 순수 작업일
        "operating_rate_type": "EARTH",       # str: 가동률 타입 (EARTH, FRAME, EXT_FIN, INT_FIN)
        "operating_rate_value": 0.75,         # float: 가동률 값 (0.0 ~ 1.0)
        "calendar_days": 5.3,                 # float: 달력일 (간트차트 표시)
        "calendar_months": 0.18,              # float: 달력월
        
        # === Critical Path / 병행작업 ===
        "front_parallel_days": 0,             # float: 앞부분 병행 일수 (회색 표시)
        "back_parallel_days": 0,              # float: 뒷부분 병행 일수 (회색 표시)
        "remarks": "",                        # str: 비고 ("병행작업" 입력 시 CP 화살표 제외)
        
        # === 품셈 정보 (선택) ===
        "standard_code": "01-01-001",         # str: 표준품셈 코드
        "total_workload": 1000,               # float: 총 작업량
        
        # === 간트차트 내부 계산값 (프론트엔드에서 추가, 저장 안 됨) ===
        "_startDay": None,                    # float: 수동 드래그 시 시작일 (optional)
        "_parallelGroup": None,               # str: 병행 그룹 ID (optional)
    },
    ...
]

중요 필드:
- remarks: "병행작업" → 간트차트에서 CP 화살표 제외
- front_parallel_days/back_parallel_days: 회색 구간 표시용
- calendar_days: 간트차트 바(bar) 길이
"""

import logging
from rest_framework import serializers
from ..models import ConstructionScheduleItem

logger = logging.getLogger(__name__)

class ConstructionScheduleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConstructionScheduleItem
        fields = ['id', 'project', 'data']
    
    def to_representation(self, instance):
        """데이터 읽기 시 로깅"""
        representation = super().to_representation(instance)
        
        # 데이터 검증 로깅
        if representation.get('data'):
            data_items = representation['data']
            logger.info(f"📥 [READ] Schedule Data Count: {len(data_items)}")
            
            # 병행작업 체크
            parallel_tasks = [
                item for item in data_items 
                if item.get('remarks') == '병행작업'
            ]
            
            if parallel_tasks:
                logger.info(f"🔵 [READ] Parallel Tasks Found: {len(parallel_tasks)}")
                for task in parallel_tasks:
                    logger.info(f"  - {task.get('process')} - {task.get('work_type')}: "
                              f"remarks='{task.get('remarks')}', "
                              f"front={task.get('front_parallel_days', 0)}, "
                              f"back={task.get('back_parallel_days', 0)}")
        
        return representation
    
    def update(self, instance, validated_data):
        """데이터 저장 시 로깅"""
        data_items = validated_data.get('data', [])
        
        logger.info(f"📤 [SAVE] Schedule Data Count: {len(data_items)}")
        
        # 병행작업 체크
        parallel_tasks = [
            item for item in data_items 
            if item.get('remarks') == '병행작업'
        ]
        
        if parallel_tasks:
            logger.info(f"🔴 [SAVE] Parallel Tasks Being Saved: {len(parallel_tasks)}")
            for task in parallel_tasks:
                logger.info(f"  - {task.get('process')} - {task.get('work_type')}: "
                          f"remarks='{task.get('remarks')}', "
                          f"front={task.get('front_parallel_days', 0)}, "
                          f"back={task.get('back_parallel_days', 0)}")
        
        # remarks 필드 정확성 검증
        for idx, item in enumerate(data_items):
            remarks = item.get('remarks', '')
            if remarks and remarks != '':
                logger.debug(f"  [{idx}] {item.get('work_type')}: remarks='{remarks}' (type: {type(remarks).__name__})")
        
        return super().update(instance, validated_data)
