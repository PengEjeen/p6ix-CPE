import random
from datetime import datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from operatio.models import WeatherStation, WeatherDailyRecord


class Command(BaseCommand):
    help = "Generate basic weather data for testing/development purposes"

    def add_arguments(self, parser):
        parser.add_argument(
            "--station-id",
            type=int,
            default=None,
            help="Weather station ID (omit to use --all-stations)",
        )
        parser.add_argument(
            "--all-stations",
            action="store_true",
            help="Generate data for all weather stations",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=None,
            help="Number of days to generate (default: from 2015-01-01 to today)",
        )
        parser.add_argument(
            "--start-date",
            type=str,
            default="2015-01-01",
            help="Start date in YYYY-MM-DD format (default: 2015-01-01)",
        )
        parser.add_argument(
            "--end-date",
            type=str,
            default=None,
            help="End date in YYYY-MM-DD format (default: today)",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing data for this station before generating",
        )

    def handle(self, *args, **options):
        all_stations = options["all_stations"]
        station_id = options["station_id"]
        clear = options["clear"]

        # Validate options
        if not all_stations and not station_id:
            self.stderr.write(
                self.style.ERROR(
                    "Either --all-stations or --station-id must be provided"
                )
            )
            return

        # Parse dates
        try:
            start_date = datetime.strptime(options["start_date"], "%Y-%m-%d").date()
        except ValueError:
            self.stderr.write(
                self.style.ERROR("Invalid start date format. Use YYYY-MM-DD")
            )
            return

        if options["end_date"]:
            try:
                end_date = datetime.strptime(options["end_date"], "%Y-%m-%d").date()
            except ValueError:
                self.stderr.write(
                    self.style.ERROR("Invalid end date format. Use YYYY-MM-DD")
                )
                return
        else:
            end_date = datetime.now().date()

        # Calculate days
        if options["days"]:
            days = options["days"]
            end_date = start_date + timedelta(days=days - 1)
        else:
            days = (end_date - start_date).days + 1

        if days <= 0:
            self.stderr.write(
                self.style.ERROR("End date must be after start date")
            )
            return

        # Get stations to process
        if all_stations:
            stations = WeatherStation.objects.all().order_by("station_id")
            if not stations.exists():
                self.stderr.write(
                    self.style.ERROR(
                        "No weather stations found. Run 'python manage.py import_weather_stations' first"
                    )
                )
                return
            self.stdout.write(
                self.style.SUCCESS(
                    f"Processing {stations.count()} stations from {start_date} to {end_date} ({days} days each)"
                )
            )
        else:
            try:
                station = WeatherStation.objects.get(station_id=station_id)
                stations = [station]
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Processing station: {station.name} (ID: {station_id}) from {start_date} to {end_date} ({days} days)"
                    )
                )
            except WeatherStation.DoesNotExist:
                self.stderr.write(
                    self.style.WARNING(f"Station {station_id} not found. Creating...")
                )
                station = WeatherStation.objects.create(
                    station_id=station_id, name=f"Station {station_id}"
                )
                stations = [station]

        total_created = 0
        total_skipped = 0

        # Process each station
        for station in stations:
            # Clear existing data if requested
            if clear:
                deleted_count = WeatherDailyRecord.objects.filter(
                    station_id=station.station_id
                ).delete()[0]
                if deleted_count > 0:
                    self.stdout.write(
                        self.style.WARNING(
                            f"[{station.name}] Deleted {deleted_count} existing records"
                        )
                    )

            created_count = 0
            skipped_count = 0
            records_to_create = []

            for i in range(days):
                current_date = start_date + timedelta(days=i)

                # Check if record already exists
                if WeatherDailyRecord.objects.filter(
                    station_id=station.station_id, date=current_date
                ).exists():
                    skipped_count += 1
                    continue

                # Generate realistic weather data
                weather_data = self._generate_weather_data(current_date, station.name)

                record = WeatherDailyRecord(
                    station_id=station.station_id,
                    date=current_date,
                    tm=current_date,
                    stnId=station.station_id,
                    stnNm=station.name,
                    **weather_data,
                )
                records_to_create.append(record)
                created_count += 1

                # Bulk create every 500 records for performance
                if len(records_to_create) >= 500:
                    WeatherDailyRecord.objects.bulk_create(records_to_create)
                    records_to_create = []
                    if all_stations:
                        self.stdout.write(
                            f"[{station.name}] Progress: {created_count}/{days} days..."
                        )

            # Create remaining records
            if records_to_create:
                WeatherDailyRecord.objects.bulk_create(records_to_create)

            total_created += created_count
            total_skipped += skipped_count

            if all_stations or created_count > 0:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ [{station.name}] Created {created_count} records, skipped {skipped_count}"
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"\n{'='*60}\n"
                f"✓ TOTAL: Created {total_created} records, skipped {total_skipped}\n"
                f"  Stations: {len(stations)}\n"
                f"  Date range: {start_date} to {end_date}\n"
                f"  Days per station: {days}\n"
                f"{'='*60}"
            )
        )

    def _generate_weather_data(self, date, station_name):
        """Generate realistic weather data based on season"""
        # Determine season
        month = date.month
        is_summer = 6 <= month <= 8
        is_winter = month in [12, 1, 2]
        is_spring = 3 <= month <= 5
        is_fall = 9 <= month <= 11

        # Base temperature by season
        if is_summer:
            base_temp = 25.0
            temp_range = 8.0
        elif is_winter:
            base_temp = 0.0
            temp_range = 10.0
        elif is_spring:
            base_temp = 12.0
            temp_range = 10.0
        else:  # fall
            base_temp = 15.0
            temp_range = 10.0

        # Random daily variation
        daily_variation = random.uniform(-5, 5)
        avg_temp = base_temp + daily_variation

        # Temperature metrics
        max_temp = avg_temp + random.uniform(3, temp_range)
        min_temp = avg_temp - random.uniform(3, temp_range)

        # Precipitation (more in summer)
        has_rain = random.random() < (0.4 if is_summer else 0.2)
        rain_amount = random.uniform(0.1, 80.0) if has_rain else 0.0

        # Humidity
        humidity = (
            random.uniform(60, 90)
            if has_rain
            else random.uniform(30, 70)
        )

        # Wind speed
        wind_speed = random.uniform(0.5, 5.0)
        max_wind_speed = wind_speed + random.uniform(2, 8)

        # Atmospheric pressure
        pressure = random.uniform(1000, 1025)

        # Cloud cover
        cloud_cover = random.randint(0, 10)

        # Ground temperature (slightly warmer than air in summer, colder in winter)
        ground_temp = avg_temp + (2 if is_summer else -1)

        # Generate payload
        payload = {
            "date": date.strftime("%Y-%m-%d"),
            "station": station_name,
            "temperature": f"{avg_temp:.1f}°C",
            "rainfall": f"{rain_amount:.1f}mm" if has_rain else "0mm",
            "humidity": f"{humidity:.0f}%",
        }

        return {
            # Temperature
            "avgTa": round(avg_temp, 1),
            "maxTa": round(max_temp, 1),
            "minTa": round(min_temp, 1),
            "maxTaHrmt": f"{random.randint(13, 16):02d}{random.randint(0, 59):02d}",
            "minTaHrmt": f"{random.randint(4, 7):02d}{random.randint(0, 59):02d}",
            # Ground temperature
            "avgTs": round(ground_temp, 1),
            "avgCm5Te": round(ground_temp - 0.5, 1),
            "avgCm10Te": round(ground_temp - 1.0, 1),
            "avgCm20Te": round(ground_temp - 1.5, 1),
            "avgCm30Te": round(ground_temp - 2.0, 1),
            # Humidity
            "avgRhm": round(humidity, 1),
            "minRhm": round(max(10, humidity - random.uniform(10, 30)), 1),
            "minRhmHrmt": f"{random.randint(13, 16):02d}{random.randint(0, 59):02d}",
            # Precipitation
            "sumRn": round(rain_amount, 1) if has_rain else 0.0,
            "hr1MaxRn": round(rain_amount * 0.3, 1) if has_rain else 0.0,
            "hr1MaxRnHrmt": f"{random.randint(10, 18):02d}{random.randint(0, 59):02d}"
            if has_rain
            else None,
            "sumRnDur": random.uniform(1, 8) if has_rain else 0.0,
            # Wind
            "avgWs": round(wind_speed, 1),
            "maxWs": round(max_wind_speed, 1),
            "maxInsWs": round(max_wind_speed + random.uniform(3, 10), 1),
            "maxWsHrmt": f"{random.randint(10, 18):02d}{random.randint(0, 59):02d}",
            "maxInsWsHrmt": f"{random.randint(10, 18):02d}{random.randint(0, 59):02d}",
            "maxWd": random.choice([0, 45, 90, 135, 180, 225, 270, 315]),
            "maxWsWd": random.choice([0, 45, 90, 135, 180, 225, 270, 315]),
            "maxInsWsWd": random.choice([0, 45, 90, 135, 180, 225, 270, 315]),
            # Pressure
            "avgPa": round(pressure - 10, 1),
            "avgPs": round(pressure, 1),
            "maxPs": round(pressure + random.uniform(1, 5), 1),
            "minPs": round(pressure - random.uniform(1, 5), 1),
            "maxPsHrmt": f"{random.randint(9, 12):02d}{random.randint(0, 59):02d}",
            "minPsHrmt": f"{random.randint(15, 18):02d}{random.randint(0, 59):02d}",
            # Cloud cover & sunshine
            "avgTca": cloud_cover,
            "avgLmac": max(0, cloud_cover - random.randint(0, 3)),
            "sumSsHr": round(random.uniform(0, 14 - cloud_cover), 1)
            if cloud_cover < 10
            else 0.0,
            "ssDur": round(random.uniform(0, 14 - cloud_cover), 1)
            if cloud_cover < 10
            else 0.0,
            # Solar radiation (higher in summer, lower in winter)
            "sumGsr": round(
                random.uniform(10, 25) if is_summer else random.uniform(5, 15), 1
            ),
            "hr1MaxIcsr": round(random.uniform(1.5, 3.5), 1),
            "hr1MaxIcsrHrmt": f"{random.randint(12, 14):02d}{random.randint(0, 59):02d}",
            # Dew point
            "avgTd": round(avg_temp - random.uniform(2, 10), 1),
            # Vapor pressure
            "avgPv": round(random.uniform(5, 25), 1),
            # Other
            "payload": payload,
        }
