import csv
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Link existing Keycloak users to federated identities (e.g. Google) "
        "using an email -> provider user id mapping file."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--provider",
            required=True,
            help="Identity provider alias in Keycloak (e.g. google)",
        )
        parser.add_argument(
            "--mapping-file",
            required=True,
            help="CSV/JSON file with email and provider user id mapping",
        )
        parser.add_argument(
            "--mapping-format",
            choices=["csv", "json"],
            default="csv",
            help="Mapping file format (default: csv)",
        )
        parser.add_argument(
            "--replace-existing",
            action="store_true",
            help="Replace existing federated identity for provider when userId differs",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes (default: dry-run)",
        )
        parser.add_argument(
            "--server-url",
            default=None,
            help="Keycloak base URL (fallback: KEYCLOAK_SERVER_URL)",
        )
        parser.add_argument(
            "--keycloak-realm",
            default=None,
            help="Target realm (fallback: KEYCLOAK_REALM)",
        )
        parser.add_argument(
            "--admin-realm",
            default=None,
            help="Realm for admin token (fallback: KEYCLOAK_ADMIN_REALM or KEYCLOAK_REALM)",
        )
        parser.add_argument(
            "--admin-client-id",
            default=None,
            help="Admin client id (fallback: KEYCLOAK_ADMIN_CLIENT_ID)",
        )
        parser.add_argument(
            "--admin-client-secret",
            default=None,
            help="Admin client secret (fallback: KEYCLOAK_ADMIN_CLIENT_SECRET)",
        )

    def handle(self, *args, **options):
        provider = (options["provider"] or "").strip().lower()
        if not provider:
            raise CommandError("Missing provider alias. Use --provider.")

        mapping_path = Path(options["mapping_file"])
        if not mapping_path.exists():
            raise CommandError(f"Mapping file not found: {mapping_path}")

        server_url = (
            options.get("server_url")
            or getattr(settings, "KEYCLOAK_SERVER_URL", "")
            or ""
        ).rstrip("/")
        realm = (
            options.get("keycloak_realm")
            or getattr(settings, "KEYCLOAK_REALM", "")
            or ""
        ).strip()
        admin_realm = (
            options.get("admin_realm")
            or self._get_env("KEYCLOAK_ADMIN_REALM")
            or realm
        ).strip()
        admin_client_id = (
            options.get("admin_client_id")
            or self._get_env("KEYCLOAK_ADMIN_CLIENT_ID")
            or ""
        ).strip()
        admin_client_secret = (
            options.get("admin_client_secret")
            or self._get_env("KEYCLOAK_ADMIN_CLIENT_SECRET")
            or ""
        ).strip()

        if not server_url:
            raise CommandError("Missing server URL. Set --server-url or KEYCLOAK_SERVER_URL.")
        if not realm:
            raise CommandError("Missing target realm. Set --keycloak-realm or KEYCLOAK_REALM.")
        if not admin_realm:
            raise CommandError("Missing admin realm. Set --admin-realm or KEYCLOAK_ADMIN_REALM.")
        if not admin_client_id or not admin_client_secret:
            raise CommandError(
                "Missing admin client credentials. Set --admin-client-id/--admin-client-secret "
                "or KEYCLOAK_ADMIN_CLIENT_ID/KEYCLOAK_ADMIN_CLIENT_SECRET."
            )

        apply = bool(options["apply"])
        replace_existing = bool(options["replace_existing"])
        mapping_format = options["mapping_format"]

        rows = self._load_mappings(mapping_path, mapping_format)
        if not rows:
            raise CommandError("No valid rows in mapping file.")

        token = self._get_admin_token(
            server_url=server_url,
            admin_realm=admin_realm,
            client_id=admin_client_id,
            client_secret=admin_client_secret,
        )

        stats = {
            "processed": 0,
            "linked": 0,
            "already_linked": 0,
            "would_link": 0,
            "skipped_no_email": 0,
            "skipped_no_provider_user_id": 0,
            "skipped_no_kc_user": 0,
            "skipped_multi_match": 0,
            "skipped_existing_mismatch": 0,
            "replaced": 0,
            "errors": 0,
        }

        self.stdout.write(
            f"provider={provider} apply={apply} replace_existing={replace_existing} rows={len(rows)}"
        )

        for row in rows:
            stats["processed"] += 1
            email = (row.get("email") or "").strip()
            provider_user_id = (row.get("provider_user_id") or "").strip()
            provider_username = (row.get("provider_username") or email).strip()

            if not email:
                stats["skipped_no_email"] += 1
                self.stdout.write(self.style.WARNING("[skip:no-email]"))
                continue
            if not provider_user_id:
                stats["skipped_no_provider_user_id"] += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"[skip:no-provider-user-id] email={email}"
                    )
                )
                continue

            try:
                users = self._find_keycloak_users_by_email(
                    server_url=server_url,
                    realm=realm,
                    token=token,
                    email=email,
                )
                if len(users) == 0:
                    stats["skipped_no_kc_user"] += 1
                    self.stdout.write(self.style.WARNING(f"[skip:no-kc-user] email={email}"))
                    continue
                if len(users) > 1:
                    stats["skipped_multi_match"] += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"[skip:multi-match] email={email} matches={len(users)}"
                        )
                    )
                    continue

                keycloak_user_id = str(users[0].get("id") or "").strip()
                if not keycloak_user_id:
                    raise RuntimeError("matched keycloak user missing id")

                federated = self._get_user_federated_identities(
                    server_url=server_url,
                    realm=realm,
                    token=token,
                    keycloak_user_id=keycloak_user_id,
                )
                current = self._find_provider_identity(federated, provider)
                if current:
                    current_user_id = str(current.get("userId") or "").strip()
                    if current_user_id == provider_user_id:
                        stats["already_linked"] += 1
                        self.stdout.write(
                            f"[already-linked] email={email} provider={provider} userId={provider_user_id}"
                        )
                        continue
                    if not replace_existing:
                        stats["skipped_existing_mismatch"] += 1
                        self.stdout.write(
                            self.style.WARNING(
                                "[skip:existing-mismatch] "
                                f"email={email} provider={provider} existing={current_user_id} "
                                f"target={provider_user_id}"
                            )
                        )
                        continue

                if not apply:
                    action = "replace" if current else "link"
                    stats["would_link"] += 1
                    self.stdout.write(
                        f"[dry-run:{action}] email={email} provider={provider} userId={provider_user_id}"
                    )
                    continue

                if current and replace_existing:
                    self._unlink_provider_identity(
                        server_url=server_url,
                        realm=realm,
                        token=token,
                        keycloak_user_id=keycloak_user_id,
                        provider=provider,
                    )
                    stats["replaced"] += 1

                self._link_provider_identity(
                    server_url=server_url,
                    realm=realm,
                    token=token,
                    keycloak_user_id=keycloak_user_id,
                    provider=provider,
                    provider_user_id=provider_user_id,
                    provider_username=provider_username,
                )
                stats["linked"] += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[linked] email={email} provider={provider} userId={provider_user_id}"
                    )
                )
            except Exception as exc:  # noqa: BLE001
                stats["errors"] += 1
                self.stderr.write(self.style.ERROR(f"[error] email={email} reason={exc}"))

        summary = (
            "Federated link complete: "
            f"processed={stats['processed']} "
            f"linked={stats['linked']} "
            f"already_linked={stats['already_linked']} "
            f"dry_run_would_link={stats['would_link']} "
            f"replaced={stats['replaced']} "
            f"skipped_no_email={stats['skipped_no_email']} "
            f"skipped_no_provider_user_id={stats['skipped_no_provider_user_id']} "
            f"skipped_no_kc_user={stats['skipped_no_kc_user']} "
            f"skipped_multi_match={stats['skipped_multi_match']} "
            f"skipped_existing_mismatch={stats['skipped_existing_mismatch']} "
            f"errors={stats['errors']}"
        )
        self.stdout.write(self.style.SUCCESS(summary))

    @staticmethod
    def _load_mappings(path: Path, fmt: str):
        rows = []
        if fmt == "csv":
            with path.open("r", encoding="utf-8-sig", newline="") as fp:
                reader = csv.DictReader(fp)
                for row in reader:
                    rows.append(Command._normalize_mapping_row(row))
        else:
            with path.open("r", encoding="utf-8") as fp:
                payload = json.load(fp)
            if not isinstance(payload, list):
                raise CommandError("JSON mapping must be a list of objects.")
            for row in payload:
                if isinstance(row, dict):
                    rows.append(Command._normalize_mapping_row(row))
        return [row for row in rows if row]

    @staticmethod
    def _normalize_mapping_row(row):
        if not isinstance(row, dict):
            return None
        email = str(row.get("email") or row.get("Email") or "").strip()
        provider_user_id = str(
            row.get("provider_user_id")
            or row.get("providerUserId")
            or row.get("sub")
            or row.get("google_sub")
            or row.get("user_id")
            or ""
        ).strip()
        provider_username = str(
            row.get("provider_username")
            or row.get("providerUserName")
            or row.get("user_name")
            or row.get("username")
            or email
        ).strip()
        return {
            "email": email,
            "provider_user_id": provider_user_id,
            "provider_username": provider_username,
        }

    @staticmethod
    def _get_env(key):
        import os

        return os.getenv(key, "")

    @staticmethod
    def _request_json(method, url, token=None, data=None, content_type=None):
        headers = {}
        payload = None
        if token:
            headers["Authorization"] = f"Bearer {token}"

        if data is not None:
            if content_type == "application/x-www-form-urlencoded":
                payload = urlencode(data).encode("utf-8")
                headers["Content-Type"] = content_type
            else:
                payload = json.dumps(data).encode("utf-8")
                headers["Content-Type"] = "application/json"

        req = Request(url, data=payload, headers=headers, method=method)
        try:
            with urlopen(req, timeout=20) as resp:
                body = resp.read().decode("utf-8")
                if not body:
                    return {}
                return json.loads(body)
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code} {url}: {body}") from exc
        except URLError as exc:
            raise RuntimeError(f"URL error {url}: {exc}") from exc

    def _get_admin_token(self, server_url, admin_realm, client_id, client_secret):
        token_url = f"{server_url}/realms/{admin_realm}/protocol/openid-connect/token"
        body = self._request_json(
            method="POST",
            url=token_url,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            content_type="application/x-www-form-urlencoded",
        )
        token = str(body.get("access_token") or "").strip()
        if not token:
            raise RuntimeError("failed to obtain admin access token")
        return token

    def _find_keycloak_users_by_email(self, server_url, realm, token, email):
        query = urlencode({"email": email, "exact": "true"})
        url = f"{server_url}/admin/realms/{realm}/users?{query}"
        body = self._request_json(method="GET", url=url, token=token)
        if isinstance(body, list):
            return body
        return []

    def _get_user_federated_identities(self, server_url, realm, token, keycloak_user_id):
        url = f"{server_url}/admin/realms/{realm}/users/{keycloak_user_id}/federated-identity"
        body = self._request_json(method="GET", url=url, token=token)
        if isinstance(body, list):
            return body
        return []

    @staticmethod
    def _find_provider_identity(identities, provider):
        for identity in identities:
            if not isinstance(identity, dict):
                continue
            alias = str(identity.get("identityProvider") or "").strip().lower()
            if alias == provider:
                return identity
        return None

    def _unlink_provider_identity(self, server_url, realm, token, keycloak_user_id, provider):
        url = (
            f"{server_url}/admin/realms/{realm}/users/{keycloak_user_id}/"
            f"federated-identity/{provider}"
        )
        self._request_json(method="DELETE", url=url, token=token)

    def _link_provider_identity(
        self,
        server_url,
        realm,
        token,
        keycloak_user_id,
        provider,
        provider_user_id,
        provider_username,
    ):
        url = (
            f"{server_url}/admin/realms/{realm}/users/{keycloak_user_id}/"
            f"federated-identity/{provider}"
        )
        self._request_json(
            method="POST",
            url=url,
            token=token,
            data={
                "userId": provider_user_id,
                "userName": provider_username,
            },
        )
