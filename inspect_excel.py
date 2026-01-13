import pandas as pd
import os

file_path = '/home/pengejeen/p6ix-CPE/backend/cpe_all_module/data/260105_생산성 분석.xlsx'
sheet_name = 'CIP 생산성 근거'

try:
    df = pd.read_excel(file_path, sheet_name=sheet_name, nrows=5)
    print("Columns:", df.columns.tolist())
    print("First 2 rows:")
    print(df.head(2).to_string())
    print("\nData Types:")
    print(df.dtypes)
except Exception as e:
    print(f"Error reading excel: {e}")
