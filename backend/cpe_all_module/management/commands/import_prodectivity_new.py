import csv
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from cpe_all_module.models import ConstructionProductivity


class Command(BaseCommand):
    help = "최종 병합 CSV 데이터를 ConstructionProductivity 템플릿으로 임포트합니다."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            type=str,
            default="",
            help="CSV 경로(미지정 시 cpe_all_module/data/construction_productivity_merged_2026-04-14_v9.csv 사용)",
        )

    def handle(self, *args, **options):
        default_path = (
            Path(settings.BASE_DIR)
            / "cpe_all_module"
            / "data"
            / "construction_productivity_merged_2026-04-14_v9.csv"
        )
        csv_path = Path(options["path"]).expanduser() if options["path"] else default_path

        if not csv_path.exists():
            raise CommandError(f"CSV 파일을 찾을 수 없습니다: {csv_path}")

        rows = self._read_csv_rows(csv_path)
        if not rows:
            raise CommandError(f"CSV 데이터가 비어 있습니다: {csv_path}")

        instances = []
        skipped = 0
        for row in rows:
            main_category = self._norm(row.get("main_category"))
            category = self._norm(row.get("category"))
            unit = self._norm(row.get("unit"))
            if not main_category or not category or not unit:
                skipped += 1
                continue

            instances.append(
                ConstructionProductivity(
                    main_category=main_category,
                    category=category,
                    sub_category=self._norm(row.get("sub_category")),
                    item_name=self._norm(row.get("item_name")),
                    standard=self._norm(row.get("standard")),
                    unit=unit,
                    crew_composition_text=self._norm(row.get("crew_composition_text")),
                    productivity_type=self._norm(row.get("productivity_type")),
                    skill_worker_1_pum=self._to_float(row.get("skill_worker_1_pum")),
                    skill_worker_1_count=self._to_float(row.get("skill_worker_1_count")),
                    skill_worker_2_pum=self._to_float(row.get("skill_worker_2_pum")),
                    skill_worker_2_count=self._to_float(row.get("skill_worker_2_count")),
                    special_worker_pum=self._to_float(row.get("special_worker_pum")),
                    special_worker_count=self._to_float(row.get("special_worker_count")),
                    common_worker_pum=self._to_float(row.get("common_worker_pum")),
                    common_worker_count=self._to_float(row.get("common_worker_count")),
                    equipment_pum=self._to_float(row.get("equipment_pum")),
                    equipment_count=self._to_float(row.get("equipment_count")),
                    pumsam_workload=self._to_float(row.get("pumsam_workload")),
                    molit_workload=self._to_float(row.get("molit_workload")),
                )
            )

        with transaction.atomic():
            deleted_count, _ = ConstructionProductivity.objects.filter(project__isnull=True).delete()
            ConstructionProductivity.objects.bulk_create(instances, batch_size=1000)

        self.stdout.write(
            self.style.SUCCESS(
                f"임포트 완료: inserted={len(instances)}, skipped={skipped}, "
                f"deleted_template={deleted_count}, source='{csv_path}'"
            )
        )

    @staticmethod
    def _read_csv_rows(path: Path):
        with path.open("r", encoding="utf-8-sig", newline="") as f:
            return list(csv.DictReader(f))

    @staticmethod
    def _norm(value):
        return str(value or "").strip()

    @classmethod
    def _to_float(cls, value):
        text = cls._norm(value).replace(",", "")
        if not text:
            return 0.0
        try:
            return float(text)
        except (TypeError, ValueError):
            return 0.0
