from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("user", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="keycloak_sub",
            field=models.CharField(blank=True, max_length=255, null=True, unique=True),
        ),
    ]
