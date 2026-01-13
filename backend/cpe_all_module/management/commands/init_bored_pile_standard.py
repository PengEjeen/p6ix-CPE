import pandas as pd
from django.core.management.base import BaseCommand
from cpe_all_module.models import BoredPileStandard

class Command(BaseCommand):
    help = 'Initialize Bored Pile Drilling Standard data from Excel'

    def handle(self, *args, **options):
        excel_path = 'cpe_all_module/data/260105_생산성 분석.xlsx'
        sheet_name = '현장타설말뚝 생산성 근거'

        # Load standard table (usually Rows 34-48 in raw excel, so index 33 to 47 approx)
        # Based on previous inspection:
        # 33 구분 | 말뚝직경 | 점질토 | 사질토 | 자갈 | 풍화암 | 연암 | 경암
        # Columns B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8 (0-indexed)
        
        df = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)
        
        # Method mapping
        method_map = {
            'R.C.D': 'RCD',
            '요동식': 'OSCILLATOR',
            '전회전식': 'ALL_CASING'
        }

        # Clear existing data
        BoredPileStandard.objects.all().delete()
        
        count = 0
        # Rows 34 to 48 (0-indexed: 33 to 48)
        for i in range(33, 49):
            raw_method = str(df.iloc[i, 1]).strip()
            diameter_spec = str(df.iloc[i, 2]).strip()
            
            # Map method
            method = method_map.get(raw_method)
            if not method or method == 'nan':
                # Handle merged cells if any
                for k in range(i-1, 32, -1):
                    prev_method = str(df.iloc[k, 1]).strip()
                    if prev_method in method_map:
                        method = method_map[prev_method]
                        break
            
            if not method or method == 'nan':
                continue

            # Read values (Clay, Sand, Gravel, Weathered, Soft Rock, Hard Rock)
            # D=3, E=4, F=5, G=6, H=7, I=8
            def get_float(val):
                try:
                    v = float(val)
                    return v if not pd.isna(v) else None
                except:
                    return None

            BoredPileStandard.objects.create(
                method=method,
                diameter_spec=diameter_spec,
                value_clay=get_float(df.iloc[i, 3]),
                value_sand=get_float(df.iloc[i, 4]),
                value_gravel=get_float(df.iloc[i, 5]),
                value_weathered=get_float(df.iloc[i, 6]),
                value_soft_rock=get_float(df.iloc[i, 7]),
                value_hard_rock=get_float(df.iloc[i, 8]),
            )
            count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully initialized {count} Bored Pile standard entries.'))
