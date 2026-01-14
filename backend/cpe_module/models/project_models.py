from django.conf import settings
from django.db import models
import uuid

# 프로젝트
class Project(models.Model):
    CALC_TYPE_CHOICES = [
        ("APARTMENT", "아파트 공기산정"),
        ("TOTAL", "전체 공기산정"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="projects",
        help_text="프로젝트 소유 사용자"
    )
    title = models.CharField("프로젝트명", max_length=100)
    description = models.TextField("설명", blank=True)
    calc_type = models.CharField(
        "공기산정 항목",
        max_length=20,
        choices=CALC_TYPE_CHOICES,
        default="APARTMENT",
    )
    
    start_date = models.DateField("공사 시작일", null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    is_delete = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.title} ({self.user})"
    
    
