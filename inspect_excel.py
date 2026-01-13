import pandas as pd

excel_path = '/home/pengejeen/p6ix-CPE/backend/cpe_all_module/data/260105_생산성 분석.xlsx'

print("\n--- CIP 생산성 근거 ---")
df_cip = pd.read_excel(excel_path, sheet_name="CIP 생산성 근거", header=None)
print(df_cip.iloc[0:20, 0:10].to_string())

print("\n--- 현장타설말뚝 생산성 근거 ---")
df_rcd = pd.read_excel(excel_path, sheet_name="현장타설말뚝 생산성 근거", header=None)
print(df_rcd.iloc[0:20, 0:10].to_string())
