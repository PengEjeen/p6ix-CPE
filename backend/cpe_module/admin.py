from django.contrib import admin
from django.db.models import JSONField
from django_json_widget.widgets import JSONEditorWidget

from .models.project_models import Project
from .models.calc_models import *
from .models.criteria_models import *
from .models.estimate_models import *
from .models.operating_rate_models import *
from .models.quotation_models import Quotation


# 일반 등록
admin.site.register(Project)
admin.site.register(ConstructionOverview)
admin.site.register(WorkCondition)
admin.site.register(PreparationPeriod)
admin.site.register(EarthworkInput)
admin.site.register(FrameWorkInput)
admin.site.register(WorkScheduleWeight)
admin.site.register(Quotation)


# ✅ 기준 데이터용 (is_admin=True) 관리 admin
@admin.register(PreparationWork)
class PreparationWorkAdmin(admin.ModelAdmin):
    # 모든 필드 수정 가능하게
    exclude = ()  # 🚨 이게 핵심: 아무 필드도 제외하지 않음
    readonly_fields = ("created_at", "updated_at")  # 시간만 읽기 전용
    list_display = (
        "id", "is_admin", "project",
        "residential_days", "non_residential_days",
        "units_under_2000", "units_2000_3000", "units_over_3000",
    )
    list_filter = ("is_admin",)
    ordering = ("-is_admin", "id")

    def save_model(self, request, obj, form, change):
        if obj.is_admin:
            obj.project = None
        super().save_model(request, obj, form, change)


@admin.register(Earthwork)
class EarthworkAdmin(admin.ModelAdmin):
    exclude = ()
    readonly_fields = ("created_at", "updated_at")
    list_display = (
        "id", "is_admin", "project",
        "support_earth_anchor", "support_raker", "support_strut",
        "production_cip", "haul_direct", "haul_cram",
    )
    list_filter = ("is_admin",)
    ordering = ("-is_admin", "id")

    def save_model(self, request, obj, form, change):
        if obj.is_admin:
            obj.project = None
        super().save_model(request, obj, form, change)


@admin.register(FrameWork)
class FrameWorkAdmin(admin.ModelAdmin):
    exclude = ()
    readonly_fields = ("created_at", "updated_at")
    list_display = (
        "id", "is_admin", "project",
        "reverse_excavation", "form_tc", "form_hydraulic", "change_cycle_time",
    )
    list_filter = ("is_admin",)
    ordering = ("-is_admin", "id")

    formfield_overrides = {
        JSONField: {"widget": JSONEditorWidget},
    }

    def save_model(self, request, obj, form, change):
        if obj.is_admin:
            obj.project = None
        super().save_model(request, obj, form, change)


# Admin Branding
admin.site.site_header = "CPE 관리 시스템"
admin.site.site_title = "CPE Admin"
admin.site.index_title = "프로젝트 및 기준 데이터 관리"
