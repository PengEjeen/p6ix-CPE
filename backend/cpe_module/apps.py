from django.apps import AppConfig
from django.db import connection
from django.db.utils import OperationalError, ProgrammingError

class CpeModuleConfig(AppConfig):
    name = "cpe_module"

    def ready(self):
        # Import signals
        import cpe_module.signals
        
        from .models.criteria_models import PreparationWork, Earthwork, FrameWork

        try:
            existing_tables = set(connection.introspection.table_names())
        except (OperationalError, ProgrammingError):
            # DB is not ready yet (e.g. first migrate)
            return

        required_tables = {
            PreparationWork._meta.db_table,
            Earthwork._meta.db_table,
            FrameWork._meta.db_table,
        }
        if not required_tables.issubset(existing_tables):
            return

        # 기준데이터 자동 생성 (최초 실행 시)
        try:
            if not PreparationWork.objects.filter(is_admin=True, project__isnull=True).exists():
                PreparationWork.objects.create(is_admin=True)
            if not Earthwork.objects.filter(is_admin=True, project__isnull=True).exists():
                Earthwork.objects.create(is_admin=True)
            if not FrameWork.objects.filter(is_admin=True, project__isnull=True).exists():
                FrameWork.objects.create(is_admin=True)
        except (OperationalError, ProgrammingError):
            return
