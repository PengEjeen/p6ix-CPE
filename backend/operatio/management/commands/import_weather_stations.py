import csv
from pathlib import Path

from django.core.management.base import BaseCommand

from operatio.models import WeatherStation


class Command(BaseCommand):
    help = "Import station list from backend/operatio/data/지점목록.csv"

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=None,
            help="Optional CSV path. Defaults to backend/operatio/data/지점목록.csv",
        )

    def handle(self, *args, **options):
        base_dir = Path(__file__).resolve().parents[4]
        csv_path = options["path"] or (base_dir / "backend" / "operatio" / "data" / "지점목록.csv")
        csv_path = Path(csv_path)

        if not csv_path.exists():
            self.stderr.write(self.style.ERROR(f"CSV not found: {csv_path}"))
            return

        created = 0
        updated = 0

        with csv_path.open(newline="", encoding="utf-8-sig") as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                station_raw = (row.get("지점") or "").strip()
                name = (row.get("지점명") or "").strip()
                if not station_raw or not name:
                    continue
                try:
                    station_id = int(station_raw)
                except ValueError:
                    continue

                obj, is_created = WeatherStation.objects.update_or_create(
                    station_id=station_id,
                    defaults={"name": name},
                )
                if is_created:
                    created += 1
                else:
                    updated += 1

        self.stdout.write(
            self.style.SUCCESS(f"Imported stations. created={created} updated={updated}")
        )
