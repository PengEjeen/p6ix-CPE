from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Load base operatio data: station CSV + ASOS daily records."

    def add_arguments(self, parser):
        parser.add_argument(
            "--stations-path",
            default=None,
            help="Optional CSV path for station list.",
        )
        parser.add_argument(
            "--service-key",
            default=None,
            help="Service key for data.go.kr",
        )
        parser.add_argument(
            "--start",
            default="20150101",
            help="Start date (YYYYMMDD) for ASOS daily import.",
        )
        parser.add_argument(
            "--end",
            default=None,
            help="End date (YYYYMMDD) for ASOS daily import. Defaults to today.",
        )
        parser.add_argument(
            "--station-ids",
            default=None,
            help="Comma-separated station ids. Defaults to all stations.",
        )

    def handle(self, *args, **options):
        stations_path = options["stations_path"]
        service_key = options["service_key"]
        start = options["start"]
        end = options["end"]
        station_ids = options["station_ids"]

        self.stdout.write("Loading station list...")
        call_command("import_weather_stations", path=stations_path)

        self.stdout.write("Loading ASOS daily records...")
        call_command(
            "import_asos_daily",
            service_key=service_key,
            start=start,
            end=end,
            station_ids=station_ids,
        )

        self.stdout.write(self.style.SUCCESS("Operatio base data load complete."))
