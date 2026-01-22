from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cpe_module", "0012_alter_workscheduleweight_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="workscheduleweight",
            name="winter_threshold_value",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True, verbose_name="동절기 기준값(℃)"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="winter_threshold_enabled",
            field=models.BooleanField(default=True, verbose_name="동절기 적용여부"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="summer_threshold_value",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=6, null=True, verbose_name="혹서기 기준값(℃)"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="summer_threshold_enabled",
            field=models.BooleanField(default=True, verbose_name="혹서기 적용여부"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="rainfall_threshold_value",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=7, null=True, verbose_name="강우량 기준값(mm)"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="rainfall_threshold_enabled",
            field=models.BooleanField(default=True, verbose_name="강우량 적용여부"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="snowfall_threshold_value",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=7, null=True, verbose_name="강설량 기준값(cm)"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="snowfall_threshold_enabled",
            field=models.BooleanField(default=True, verbose_name="강설량 적용여부"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="dust_alert_level",
            field=models.CharField(choices=[("ALERT", "경보"), ("WARNING", "주의"), ("NONE", "미적용")], default="NONE", max_length=10, verbose_name="미세먼지 기준"),
        ),
        migrations.AddField(
            model_name="workscheduleweight",
            name="sector_type",
            field=models.CharField(choices=[("PUBLIC", "공공"), ("PRIVATE", "민간")], default="PRIVATE", max_length=10, verbose_name="공공/민간"),
        ),
    ]
