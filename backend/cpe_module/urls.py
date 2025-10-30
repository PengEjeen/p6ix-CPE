from django.urls import path
from .views import operating_rate, project, criteria, calc, quotation

app_name = 'cpe_module'

urlpatterns = [
    #project
    path("project/", project.get_projects, name="get_projects"),
    path("project/create/", project.create_project, name="create_project"),
    path("project/<str:project_id>/", project.detail_project, name="detail_project"),
    path("project/<str:project_id>/update/", project.update_project, name="update_project"),
    path("project/<str:project_id>/delete/", project.delete_project, name="delete_project"),

    #operating_rate
    path("work-schedule-weights/", operating_rate.get_work_schedule_weights, name="get_work_schedule_weights"),
    path("work-schedule-weights/create/", operating_rate.create_work_schedule_weight, name="create_work_schedule_weight"),
    path("work-schedule-weights/<str:project_id>/", operating_rate.detail_work_schedule_weight, name="detail_work_schedule_weight"),
    path("work-schedule-weights/<str:project_id>/update/", operating_rate.update_work_schedule_weight, name="update_work_schedule_weight"),
        
    #criteria
    ##준비 정리 가설 마감공사
    path("criteria/preparation/<str:project_id>/", criteria.detail_preparation_work, name="detail_preparation_work"),
    path("criteria/preparation/<str:project_id>/update/", criteria.update_preparation_work, name="update_preparation_work"),

    ##토공사
    path("criteria/earthwork/<str:project_id>/", criteria.detail_earthwork, name="detail_earthwork"),
    path("criteria/earthwork/<str:project_id>/update/", criteria.update_earthwork, name="update_earthwork"),

    ##골조공사
    path("criteria/framework/<str:project_id>/", criteria.detail_framework, name="detail_framework"),
    path("criteria/framework/<str:project_id>/update/", criteria.update_framework, name="update_framework"),

    #공기산정 calc
    ##construction overview
    path("calc/construction-overview/<str:project_id>/", calc.detail_construction_overview),
    path("calc/construction-overview/<str:project_id>/update/", calc.update_construction_overview),

    ##work condition
    path("calc/work-condition/<str:project_id>/", calc.detail_work_condition),
    path("calc/work-condition/<str:project_id>/update/", calc.update_work_condition),

    #preparation period
    path("calc/preparation-period/<str:project_id>/", calc.detail_preparation_period),
    path("calc/preparation-period/<str:project_id>/update/", calc.update_preparation_period),

    #earthwork input
    path("calc/earthwork-input/<str:project_id>/", calc.detail_earthwork_input),
    path("calc/earthwork-input/<str:project_id>/update/", calc.update_earthwork_input),

    #framework input
    path("calc/framework-input/<str:project_id>/", calc.detail_framework_input),
    path("calc/framework-input/<str:project_id>/update/", calc.update_framework_input),

    #quotation
    path("quotation/<str:project_id>/", quotation.detail_quotation),
    path("quotation/<str:project_id>/update/", quotation.update_quotation),
    path("quotation/<str:project_id>/ai_update/", quotation.update_ai_quotation)

    ]