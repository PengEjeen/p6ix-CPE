from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cpe_module", "0009_alter_earthworkinput_designated_diameter"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="calc_type",
            field=models.CharField(
                choices=[("APARTMENT", "아파트 공기산정"), ("TOTAL", "전체 공기산정")],
                default="APARTMENT",
                max_length=20,
                verbose_name="공기산정 항목",
            ),
        ),
    ]
