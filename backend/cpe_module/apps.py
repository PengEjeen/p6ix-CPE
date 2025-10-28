from django.apps import AppConfig

class CpeModuleConfig(AppConfig):
    name = "cpe_module"

    def ready(self):
        from .models.criteria_models import PreparationWork, Earthwork, FrameWork
        # 기준데이터 자동 생성 (최초 실행 시)
        if not PreparationWork.objects.filter(is_admin=True, project__isnull=True).exists():
            PreparationWork.objects.create(is_admin=True)
        if not Earthwork.objects.filter(is_admin=True, project__isnull=True).exists():
            Earthwork.objects.create(is_admin=True)
        if not FrameWork.objects.filter(is_admin=True, project__isnull=True).exists():
            FrameWork.objects.create(is_admin=True)
