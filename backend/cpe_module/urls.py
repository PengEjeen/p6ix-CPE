from django.urls import path
from .views import operating_rate, project, criteria

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
    path("criteria/preparation/<str:project_id>/", criteria.detail_preparation_work, name="detail_work_schedule_weight"),
    path("criteria/preparation/<str:project_id>/update/", criteria.update_preparation_work, name="update_work_schedule_weight"),
    
    ##토공사
    path("criteria/earthwork/<str:project_id>/", criteria.detail_earthwork, name="detail_work_schedule_weight"),
    path("criteria/earthwork/<str:project_id>/update/", criteria.update_earthwork, name="update_work_schedule_weight"),
    
    ##골조공사
    path("criteria/framework/<str:project_id>/", criteria.detail_framework, name="detail_work_schedule_weight"),
    path("criteria/framework/<str:project_id>/update/", criteria.update_framework, name="update_work_schedule_weight"),
    ]