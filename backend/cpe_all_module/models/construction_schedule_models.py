from django.db import models

class ConstructionScheduleItem(models.Model):
    project = models.ForeignKey(
        "cpe_module.Project",
        on_delete=models.CASCADE,
        related_name="schedule_items",
        verbose_name="프로젝트"
    )
    data = models.JSONField(default=list, blank=True, verbose_name="스케줄 데이터 (JSON)")
    
    class Meta:
        verbose_name = "공기산정 상세 항목 (JSON)"
        
    def __str__(self):
        return f"Schedule Data for Project {self.project_id}"
