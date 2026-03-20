import csv
import json
from pathlib import Path
from typing import Optional

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db.models import Q


class Command(BaseCommand):
    help = (
        "Export app users to Keycloak migration files. "
        "By default, exports active users that are not linked to Keycloak yet."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="keycloak_user_import.json",
            help="Output file path",
        )
        parser.add_argument(
            "--format",
            choices=["keycloak-json", "csv"],
            default="keycloak-json",
            help="Export format",
        )
        parser.add_argument(
            "--include-linked",
            action="store_true",
            help="Include users that already have keycloak_sub",
        )
        parser.add_argument(
            "--include-inactive",
            action="store_true",
            help="Include inactive users",
        )
        parser.add_argument(
            "--include-empty-email",
            action="store_true",
            help="Include users with empty email",
        )
        parser.add_argument(
            "--email-verified",
            action="store_true",
            help="Mark exported users as emailVerified=true in Keycloak JSON",
        )
        parser.add_argument(
            "--temporary-password",
            default=None,
            help=(
                "Optional temporary password to include for every exported user "
                "(Keycloak JSON only)."
            ),
        )
        parser.add_argument(
            "--password-not-temporary",
            action="store_true",
            help="Mark --temporary-password as non-temporary",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Maximum number of users to export (0 means all)",
        )

    def handle(self, *args, **options):
        user_model = get_user_model()
        users = user_model.objects.all().order_by("date_joined", "username")

        if not options["include_linked"]:
            users = users.filter(Q(keycloak_sub__isnull=True) | Q(keycloak_sub=""))
        if not options["include_inactive"]:
            users = users.filter(is_active=True)

        selected = []
        skipped_empty_email = 0

        for user in users.iterator():
            email = (user.email or "").strip()
            if not options["include_empty_email"] and not email:
                skipped_empty_email += 1
                continue
            selected.append(user)

        limit = options["limit"]
        if limit > 0:
            selected = selected[:limit]

        output_path = Path(options["output"]).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if options["format"] == "csv":
            self._export_csv(output_path, selected)
        else:
            self._export_keycloak_json(
                output_path=output_path,
                users=selected,
                email_verified=options["email_verified"],
                temporary_password=options["temporary_password"],
                password_temporary=not options["password_not_temporary"],
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Export complete: "
                f"written={len(selected)} skipped_empty_email={skipped_empty_email} "
                f"output={output_path}"
            )
        )

    def _export_csv(self, output_path: Path, users):
        with output_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "id",
                    "username",
                    "email",
                    "first_name",
                    "last_name",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "login_provider",
                    "keycloak_sub",
                    "role",
                    "company",
                    "department",
                    "position",
                    "phone",
                ],
            )
            writer.writeheader()
            for user in users:
                writer.writerow(
                    {
                        "id": str(user.id),
                        "username": user.username,
                        "email": user.email or "",
                        "first_name": user.first_name or "",
                        "last_name": user.last_name or "",
                        "is_active": bool(user.is_active),
                        "is_staff": bool(user.is_staff),
                        "is_superuser": bool(user.is_superuser),
                        "login_provider": user.login_provider or "",
                        "keycloak_sub": user.keycloak_sub or "",
                        "role": user.role or "",
                        "company": user.company or "",
                        "department": user.department or "",
                        "position": user.position or "",
                        "phone": user.phone or "",
                    }
                )

    def _export_keycloak_json(
        self,
        output_path: Path,
        users,
        email_verified: bool,
        temporary_password: Optional[str],
        password_temporary: bool,
    ):
        payload = {"users": []}

        for user in users:
            email = (user.email or "").strip()
            kc_user = {
                "username": user.username,
                "enabled": bool(user.is_active),
                "firstName": user.first_name or "",
                "lastName": user.last_name or "",
                "attributes": {
                    "legacy_user_id": [str(user.id)],
                    "legacy_login_provider": [user.login_provider or "local"],
                    "legacy_role": [user.role or "user"],
                },
            }

            if email:
                kc_user["email"] = email
                kc_user["emailVerified"] = bool(email_verified)

            for field_name in ("company", "department", "position", "phone"):
                value = getattr(user, field_name, "") or ""
                if value:
                    kc_user["attributes"][f"legacy_{field_name}"] = [value]

            if temporary_password:
                kc_user["credentials"] = [
                    {
                        "type": "password",
                        "value": temporary_password,
                        "temporary": bool(password_temporary),
                    }
                ]
                if password_temporary:
                    kc_user["requiredActions"] = ["UPDATE_PASSWORD"]

            payload["users"].append(kc_user)

        with output_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
