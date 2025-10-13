from django.urls import path
from .views import operating_rate

app_name = 'cpe_module'

urlpatterns = [
    path("work-schedule-weights/", operating_rate.get_work_schedule_weights, name="get_work_schedule_weights"),
    path("work-schedule-weights/create/", operating_rate.create_work_schedule_weight, name="create_work_schedule_weight"),
    path("work-schedule-weights/<int:pk>/", operating_rate.detail_work_schedule_weight, name="detail_work_schedule_weight"),
    path("work-schedule-weights/<int:pk>/update/", operating_rate.update_work_schedule_weight, name="update_work_schedule_weight"),
    path("work-schedule-weights/<int:pk>/delete/", operating_rate.soft_delete_work_schedule_weight, name="soft_delete_work_schedule_weight"),
]