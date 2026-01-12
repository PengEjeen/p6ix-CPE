import pandas as pd
from django.core.management.base import BaseCommand
from cpe_all_module.models import ConstructionProductivity

class Command(BaseCommand):
    help = '국토교통부 표준 및 표준품셈 데이터를 CSV에서 임포트합니다.'

    def handle(self, *args, **options):
        import os
        from django.conf import settings
        
        # 파일 경로: backend/cpe_all_module/data/260105_생산성 분석.xlsx
        base_dir = settings.BASE_DIR
        file_path = os.path.join(base_dir, 'cpe_all_module', 'data', '260105_생산성 분석.xlsx')
        
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f'파일을 찾을 수 없습니다: {file_path}'))
            return

        # 엑셀 파일 로드
        try:
            df = pd.read_excel(file_path, sheet_name='국토교통부표준+표준품셈', header=None, engine='openpyxl')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'엑셀 파일 읽기 실패: {str(e)}'))
            return

        # 데이터는 5행(인덱스 4)부터 실제 값이 시작됨
        data_rows = df.iloc[4:]

        current_main = ""
        current_cat = ""
        current_sub_cat = ""
        
        instances = []

        def clean_float(val):
            try:
                if pd.isna(val) or str(val).strip() == "":
                    return 0.0
                return float(str(val).replace(',', ''))
            except ValueError:
                return 0.0

        def clean_str(val):
            if pd.isna(val):
                return ""
            return str(val).strip()

        # 상태 유지를 위한 변수 초기화 (Merged Cell 처리용)
        last_main = ""
        last_cat = ""
        last_sub_cat = ""
        last_item_name = ""
        last_standard = "" # 규격 상태 추가

        for idx, row in data_rows.iterrows():
            col1_val = clean_str(row[1])
            col2_val = clean_str(row[2])
            col3_val = clean_str(row[3])
            col4_val = clean_str(row[4])
            col5_val = clean_str(row[5]) # 규격 (Column 5)
            
            # 1. Main Category (Col 1)
            # 값이 있으면 업데이트. "N." 헤더면 메인 업데이트 + 하위 리셋.
            if col1_val:
                if any(col1_val.startswith(f"{i}.") for i in range(1, 20)):
                    last_main = col1_val
                    last_cat = ""
                    last_sub_cat = ""
                    last_item_name = ""
                    last_standard = ""
                    continue # 헤더 행은 스킵
                else:
                    last_main = col1_val
            
            # 2. Category (Col 2)
            if col2_val:
                last_cat = col2_val
                last_sub_cat = ""   # 상위 분류 바뀌면 하위 리셋
                last_item_name = "" # 상위 분류 바뀌면 아이템 리셋
                last_standard = ""
            
            # 3. Sub Category (Col 3)
            if col3_val:
                last_sub_cat = col3_val
                last_item_name = "" 
                last_standard = ""

            # 4. Item Name (Col 4)
            if col4_val:
                last_item_name = col4_val
                last_standard = "" # 새 항목이 나오면 규격도 리셋 (보통 같이 나옴)

            # 5. Standard (Col 5)
            if col5_val:
                last_standard = col5_val
            
            # 데이터 행 유효성 검사 (단위가 없으면 스킵)
            unit = clean_str(row[6])
            if not unit:
                continue

            # 필수 값 확인
            if not last_main or not last_cat:
                continue
            
            # 모델 인스턴스 생성
            productivity = ConstructionProductivity(
                main_category=last_main,
                category=last_cat,
                sub_category=last_sub_cat,
                item_name=last_item_name, # Fallback 없이 오직 Col 4 값만 사용 (stateful)
                standard=last_standard,     # 규격
                unit=unit,
                crew_composition_text=clean_str(row[7]),
                productivity_type=clean_str(row[8]),
                
                # 투입 품/인원 상세
                skill_worker_1_pum=clean_float(row[9]),
                skill_worker_1_count=clean_float(row[10]),
                skill_worker_2_pum=clean_float(row[11]),
                skill_worker_2_count=clean_float(row[12]),
                special_worker_pum=clean_float(row[13]),
                special_worker_count=clean_float(row[14]),
                common_worker_pum=clean_float(row[15]),
                common_worker_count=clean_float(row[16]),
                equipment_pum=clean_float(row[17]),
                equipment_count=clean_float(row[18]),
                
                # 1일 작업량
                pumsam_workload=clean_float(row[20]),
                molit_workload=clean_float(row[21]),
            )
            instances.append(productivity)

        # DB 초기화 (데이터 삭제 및 ID 리셋)
        from django.db import connection
        with connection.cursor() as cursor:
            # SQLite specific logic to reset auto-increment
            cursor.execute("DELETE FROM cpe_all_module_constructionproductivity")
            cursor.execute("DELETE FROM sqlite_sequence WHERE name='cpe_all_module_constructionproductivity'")
            
        ConstructionProductivity.objects.bulk_create(instances)
        self.stdout.write(self.style.SUCCESS(f'성공적으로 {len(instances)}개의 데이터를 입력했습니다 (ID 초기화 완료).'))