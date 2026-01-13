from django.contrib import admin
from .models import ConstructionProductivity, CIPProductivityBasis, CIPDrillingStandard

@admin.register(ConstructionProductivity)
class ConstructionProductivityAdmin(admin.ModelAdmin):
    list_display = ("project", "main_category", "category", "item_name", "unit")
    list_filter = ("main_category", "category")
    search_fields = ("item_name", "category")

@admin.register(CIPProductivityBasis)
class CIPProductivityBasisAdmin(admin.ModelAdmin):
    list_display = ("description", "project", "drill_diameter", "total_depth", "daily_production_count")
    search_fields = ("description",)

@admin.register(CIPDrillingStandard)
class CIPDrillingStandardAdmin(admin.ModelAdmin):
    list_display = ("bit_type", "diameter_spec", "value_clay", "value_sand", "value_weathered", "value_soft_rock", "value_hard_rock", "value_mixed")
    list_filter = ("bit_type",)
    ordering = ("bit_type", "diameter_spec")
