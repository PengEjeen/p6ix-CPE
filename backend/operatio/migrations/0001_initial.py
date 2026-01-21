from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="WeatherStation",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("station_id", models.IntegerField(unique=True, verbose_name="지점")),
                ("name", models.CharField(max_length=100, verbose_name="지점명")),
            ],
            options={
                "verbose_name": "지점",
                "verbose_name_plural": "지점 목록",
                "ordering": ["station_id"],
            },
        ),
    ]
