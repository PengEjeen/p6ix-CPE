
import sys
import os

# Add backend directory to path to find the module
sys.path.append('/home/pengejeen/p6ix-CPE/backend')

from cpe_all_module.initial_data import get_default_schedule_data

try:
    data = get_default_schedule_data()
    print(f"Successfully loaded {len(data)} items.")
    
    # Check first item
    print("First item:", data[0])
    
    # Check last item
    print("Last item:", data[-1])
    
    # Check critical categories mapping
    rc_items = [d for d in data if 'RC공사' in d['main_category']]
    if rc_items:
        print(f"RC items count: {len(rc_items)}")
        print("First RC item type:", rc_items[0]['operating_rate_type'])
        if rc_items[0]['operating_rate_type'] != 'FRAME':
            print("ERROR: RC item should be FRAME")
            sys.exit(1)
            
    int_fin_items = [d for d in data if '내부마감' in d['main_category']]
    if int_fin_items:
        print(f"Internal Finish items count: {len(int_fin_items)}")
        print("First Int Fin item type:", int_fin_items[0]['operating_rate_type'])
        if int_fin_items[0]['operating_rate_type'] != 'INT_FIN':
            print("ERROR: Internal Finish item should be INT_FIN")
            sys.exit(1)

    print("Verification Passed")

except Exception as e:
    print(f"Verification Failed: {e}")
    sys.exit(1)
