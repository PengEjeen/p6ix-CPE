from django.conf import settings
from django.db import models


class FloorBatchTemplate(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="floor_batch_templates",
    )
    name = models.CharField(max_length=120, verbose_name="템플릿명")
    main_category = models.CharField(max_length=120, blank=True, default="", verbose_name="대공종")
    rows = models.JSONField(default=list, verbose_name="템플릿 행")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]

    def __str__(self):
        return f"{self.name} ({self.user})"
