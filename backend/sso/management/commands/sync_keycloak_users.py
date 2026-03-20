import base64
import binascii
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q


class Command(BaseCommand):
    help = (
        "Sync local users to Keycloak by email. "
        "If user exists in Keycloak -> link keycloak_sub. "
        "If not -> create user in Keycloak, then link keycloak_sub."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes to Keycloak/local DB (default: dry-run)",
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
            "--include-linked",
            action="store_true",
            help="Include users that already have keycloak_sub",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Maximum users to process (0 means all)",
        )
        parser.add_argument(
            "--email-verified",
            action="store_true",
            help="Set emailVerified=true when creating new Keycloak users",
        )
        parser.add_argument(
            "--temporary-password",
            default=None,
            help="Optional initial password when creating Keycloak users",
        )
        parser.add_argument(
            "--use-django-password-hash",
            action="store_true",
            help=(
                "When creating new users, convert Django PBKDF2 hashes to "
                "Keycloak credentialData/secretData. "
                "Also updates matched existing Keycloak users when --apply is used."
            ),
        )
        parser.add_argument(
            "--password-not-temporary",
            action="store_true",
            help="Use non-temporary password when --temporary-password is set",
        )
        parser.add_argument(
            "--admin-client-id",
            default=None,
            help="Keycloak admin client_id (fallback: env KEYCLOAK_ADMIN_CLIENT_ID)",
        )
        parser.add_argument(
            "--admin-client-secret",
            default=None,
            help="Keycloak admin client_secret (fallback: env KEYCLOAK_ADMIN_CLIENT_SECRET)",
        )
        parser.add_argument(
            "--admin-realm",
            default=None,
            help="Realm for admin token (fallback: env KEYCLOAK_ADMIN_REALM or KEYCLOAK_REALM)",
        )
        parser.add_argument(
            "--keycloak-realm",
            default=None,
            help="Target realm for user sync (fallback: env KEYCLOAK_REALM)",
        )
        parser.add_argument(
            "--server-url",
            default=None,
            help="Keycloak base URL (fallback: env KEYCLOAK_SERVER_URL)",
        )

    def handle(self, *args, **options):
        from django.conf import settings

        server_url = (
            options.get("server_url")
            or getattr(settings, "KEYCLOAK_SERVER_URL", "")
            or ""
        ).rstrip("/")
        target_realm = (
            options.get("keycloak_realm")
            or getattr(settings, "KEYCLOAK_REALM", "")
            or ""
        ).strip()
        admin_realm = (
            options.get("admin_realm")
            or self._get_env("KEYCLOAK_ADMIN_REALM")
            or target_realm
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
        if not target_realm:
            raise CommandError("Missing target realm. Set --keycloak-realm or KEYCLOAK_REALM.")
        if not admin_realm:
            raise CommandError("Missing admin realm. Set --admin-realm or KEYCLOAK_ADMIN_REALM.")
        if not admin_client_id or not admin_client_secret:
            raise CommandError(
                "Missing admin client credentials. "
                "Set --admin-client-id/--admin-client-secret "
                "or KEYCLOAK_ADMIN_CLIENT_ID/KEYCLOAK_ADMIN_CLIENT_SECRET."
            )

        apply = bool(options["apply"])
        password_temporary = not bool(options["password_not_temporary"])
        access_token = self._get_admin_token(
            server_url=server_url,
            admin_realm=admin_realm,
            client_id=admin_client_id,
            client_secret=admin_client_secret,
        )

        user_model = get_user_model()
        queryset = user_model.objects.all().order_by("date_joined", "username")
        if not options["include_linked"]:
            queryset = queryset.filter(Q(keycloak_sub__isnull=True) | Q(keycloak_sub=""))
        if not options["include_inactive"]:
            queryset = queryset.filter(is_active=True)

        users = list(queryset[: options["limit"]] if options["limit"] > 0 else queryset)

        stats = {
            "processed": 0,
            "linked_existing": 0,
            "created": 0,
            "updated_existing_password": 0,
            "dry_run_would_create": 0,
            "dry_run_would_link": 0,
            "dry_run_would_update_existing_password": 0,
            "skipped_no_email": 0,
            "skipped_multi_match": 0,
            "errors": 0,
        }

        for user in users:
            stats["processed"] += 1
            email = (user.email or "").strip()
            if not email and not options["include_empty_email"]:
                stats["skipped_no_email"] += 1
                self.stdout.write(
                    self.style.WARNING(f"[skip:no-email] user={user.username} id={user.id}")
                )
                continue

            try:
                kc_users = self._find_keycloak_users_by_email(
                    server_url=server_url,
                    realm=target_realm,
                    token=access_token,
                    email=email,
                )
                if len(kc_users) > 1:
                    stats["skipped_multi_match"] += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"[skip:multi-match] user={user.username} email={email} matches={len(kc_users)}"
                        )
                    )
                    continue

                if len(kc_users) == 1:
                    kc_id = str(kc_users[0].get("id") or "").strip()
                    if not kc_id:
                        raise RuntimeError("matched user missing id")

                    if apply:
                        if options["use_django_password_hash"]:
                            self._set_existing_keycloak_password_hash(
                                server_url=server_url,
                                realm=target_realm,
                                token=access_token,
                                keycloak_user_id=kc_id,
                                encoded_password=user.password or "",
                            )
                            stats["updated_existing_password"] += 1
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f"[updated-password-hash] user={user.username} email={email} keycloak_sub={kc_id}"
                                )
                            )
                        self._link_local_user(user, kc_id)
                        stats["linked_existing"] += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"[linked] user={user.username} email={email} keycloak_sub={kc_id}"
                            )
                        )
                    else:
                        if options["use_django_password_hash"]:
                            _ = self._django_password_to_keycloak_credential(user.password or "")
                            stats["dry_run_would_update_existing_password"] += 1
                            self.stdout.write(
                                f"[dry-run:update-password-hash] user={user.username} email={email} keycloak_sub={kc_id}"
                            )
                        stats["dry_run_would_link"] += 1
                        self.stdout.write(
                            f"[dry-run:link] user={user.username} email={email} keycloak_sub={kc_id}"
                        )
                    continue

                if not apply:
                    stats["dry_run_would_create"] += 1
                    self.stdout.write(f"[dry-run:create] user={user.username} email={email}")
                    continue

                created_id = self._create_keycloak_user(
                    server_url=server_url,
                    realm=target_realm,
                    token=access_token,
                    user=user,
                    email_verified=bool(options["email_verified"]),
                    temporary_password=options["temporary_password"],
                    password_temporary=password_temporary,
                    use_django_password_hash=bool(options["use_django_password_hash"]),
                )
                if not created_id:
                    raise RuntimeError("create user succeeded but user id was not found")

                self._link_local_user(user, created_id)
                stats["created"] += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[created+linked] user={user.username} email={email} keycloak_sub={created_id}"
                    )
                )
            except Exception as exc:  # noqa: BLE001
                stats["errors"] += 1
                self.stderr.write(self.style.ERROR(f"[error] user={user.username} reason={exc}"))

        summary = (
            "Sync complete: "
            f"processed={stats['processed']} "
            f"linked_existing={stats['linked_existing']} "
            f"created={stats['created']} "
            f"updated_existing_password={stats['updated_existing_password']} "
            f"dry_run_would_link={stats['dry_run_would_link']} "
            f"dry_run_would_create={stats['dry_run_would_create']} "
            f"dry_run_would_update_existing_password={stats['dry_run_would_update_existing_password']} "
            f"skipped_no_email={stats['skipped_no_email']} "
            f"skipped_multi_match={stats['skipped_multi_match']} "
            f"errors={stats['errors']}"
        )
        self.stdout.write(self.style.SUCCESS(summary))

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
            with urlopen(req, timeout=15) as resp:
                body = resp.read().decode("utf-8")
                location = resp.headers.get("Location", "")
                if not body:
                    return {}, location
                return json.loads(body), location
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"HTTP {exc.code} {url}: {body}") from exc
        except URLError as exc:
            raise RuntimeError(f"URL error {url}: {exc}") from exc

    def _get_admin_token(self, server_url, admin_realm, client_id, client_secret):
        token_url = f"{server_url}/realms/{admin_realm}/protocol/openid-connect/token"
        body, _ = self._request_json(
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
        if not email:
            return []
        query = urlencode({"email": email, "exact": "true"})
        url = f"{server_url}/admin/realms/{realm}/users?{query}"
        body, _ = self._request_json(method="GET", url=url, token=token)
        if isinstance(body, list):
            return body
        return []

    def _create_keycloak_user(
        self,
        server_url,
        realm,
        token,
        user,
        email_verified,
        temporary_password,
        password_temporary,
        use_django_password_hash,
    ):
        email = (user.email or "").strip()
        payload = {
            "username": user.username,
            "email": email if email else None,
            "enabled": bool(user.is_active),
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "emailVerified": bool(email_verified),
            "attributes": {
                "legacy_user_id": [str(user.id)],
                "legacy_login_provider": [user.login_provider or "local"],
                "legacy_role": [user.role or "user"],
            },
        }
        if not email:
            payload.pop("email", None)
            payload.pop("emailVerified", None)

        for field_name in ("company", "department", "position", "phone"):
            value = getattr(user, field_name, "") or ""
            if value:
                payload["attributes"][f"legacy_{field_name}"] = [value]

        if use_django_password_hash:
            payload["credentials"] = [
                self._django_password_to_keycloak_credential(user.password or "")
            ]
        elif temporary_password:
            payload["credentials"] = [
                {
                    "type": "password",
                    "value": temporary_password,
                    "temporary": bool(password_temporary),
                }
            ]
            if password_temporary:
                payload["requiredActions"] = ["UPDATE_PASSWORD"]

        create_url = f"{server_url}/admin/realms/{realm}/users"
        _, location = self._request_json(
            method="POST",
            url=create_url,
            token=token,
            data=payload,
        )
        if location:
            return location.rstrip("/").split("/")[-1]

        found = self._find_keycloak_users_by_email(
            server_url=server_url,
            realm=realm,
            token=token,
            email=email,
        )
        if len(found) == 1:
            return str(found[0].get("id") or "").strip()
        return ""

    def _set_existing_keycloak_password_hash(
        self,
        server_url,
        realm,
        token,
        keycloak_user_id,
        encoded_password,
    ):
        credential = self._django_password_to_keycloak_credential(encoded_password)
        reset_url = f"{server_url}/admin/realms/{realm}/users/{keycloak_user_id}/reset-password"
        update_user_url = f"{server_url}/admin/realms/{realm}/users/{keycloak_user_id}"

        try:
            self._request_json(
                method="PUT",
                url=reset_url,
                token=token,
                data=credential,
            )
            return
        except RuntimeError as first_exc:
            try:
                self._request_json(
                    method="PUT",
                    url=update_user_url,
                    token=token,
                    data={"credentials": [credential]},
                )
                return
            except RuntimeError as second_exc:
                raise RuntimeError(
                    "failed to set hash credential "
                    f"(reset-password: {first_exc}; update-user: {second_exc})"
                ) from second_exc

    @staticmethod
    def _django_password_to_keycloak_credential(encoded_password):
        """
        Convert Django password hash -> Keycloak password credential.

        Supported Django formats:
        - pbkdf2_sha256$<iterations>$<salt>$<base64_hash>
        - pbkdf2_sha1$<iterations>$<salt>$<base64_hash>
        """
        if not encoded_password:
            raise ValueError("empty Django password hash")
        if encoded_password.startswith("!"):
            raise ValueError("unusable Django password hash")

        parts = encoded_password.split("$", 3)
        if len(parts) != 4:
            raise ValueError(f"unsupported Django hash format: {encoded_password[:40]}")

        django_algorithm, iterations_raw, salt_raw, hash_raw = parts
        algorithm_map = {
            "pbkdf2_sha256": "pbkdf2-sha256",
            "pbkdf2_sha1": "pbkdf2",
        }
        keycloak_algorithm = algorithm_map.get(django_algorithm)
        if not keycloak_algorithm:
            raise ValueError(f"unsupported Django algorithm: {django_algorithm}")

        try:
            hash_iterations = int(iterations_raw)
        except ValueError as exc:
            raise ValueError(f"invalid hash iterations: {iterations_raw}") from exc
        if hash_iterations <= 0:
            raise ValueError(f"invalid hash iterations: {hash_iterations}")

        hash_b64 = Command._normalize_base64(hash_raw.strip())
        try:
            base64.b64decode(hash_b64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("invalid Django hash base64 payload") from exc

        salt_b64 = base64.b64encode(salt_raw.encode("utf-8")).decode("ascii")
        credential_data = {
            "hashIterations": hash_iterations,
            "algorithm": keycloak_algorithm,
            "additionalParameters": {},
        }
        secret_data = {
            "value": hash_b64,
            "salt": salt_b64,
            "additionalParameters": {},
        }

        return {
            "type": "password",
            "credentialData": json.dumps(credential_data, separators=(",", ":")),
            "secretData": json.dumps(secret_data, separators=(",", ":")),
        }

    @staticmethod
    def _normalize_base64(value):
        remainder = len(value) % 4
        if remainder == 0:
            return value
        return value + ("=" * (4 - remainder))

    @staticmethod
    def _link_local_user(user, keycloak_sub):
        user.keycloak_sub = keycloak_sub
        user.login_provider = "keycloak"
        user.save(update_fields=["keycloak_sub", "login_provider"])
