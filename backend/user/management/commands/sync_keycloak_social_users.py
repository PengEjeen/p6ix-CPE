import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q


class Command(BaseCommand):
    help = (
        "Sync social-login users to Keycloak by email. "
        "If user exists in Keycloak -> link keycloak_sub. "
        "If not -> create Keycloak user without password credential, then link keycloak_sub."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes to Keycloak/local DB (default: dry-run)",
        )
        parser.add_argument(
            "--providers",
            default="google,kakao,naver,apple",
            help="Comma-separated login_provider targets (default: google,kakao,naver,apple)",
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
            dest="email_verified",
            action="store_true",
            default=True,
            help="Set emailVerified=true when creating Keycloak users (default: true)",
        )
        parser.add_argument(
            "--no-email-verified",
            dest="email_verified",
            action="store_false",
            help="Set emailVerified=false when creating Keycloak users",
        )
        parser.add_argument(
            "--set-login-provider-keycloak",
            action="store_true",
            help="Also set local login_provider='keycloak' when linking",
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

        providers = self._parse_providers(options.get("providers", ""))
        if not providers:
            raise CommandError("No providers to process. Use --providers with at least one value.")

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
        email_verified = bool(options["email_verified"])
        set_login_provider_keycloak = bool(options["set_login_provider_keycloak"])

        access_token = self._get_admin_token(
            server_url=server_url,
            admin_realm=admin_realm,
            client_id=admin_client_id,
            client_secret=admin_client_secret,
        )

        user_model = get_user_model()
        queryset = user_model.objects.filter(login_provider__in=providers).order_by(
            "date_joined", "username"
        )
        if not options["include_linked"]:
            queryset = queryset.filter(Q(keycloak_sub__isnull=True) | Q(keycloak_sub=""))
        if not options["include_inactive"]:
            queryset = queryset.filter(is_active=True)

        users = list(queryset[: options["limit"]] if options["limit"] > 0 else queryset)

        stats = {
            "processed": 0,
            "linked_existing": 0,
            "created": 0,
            "dry_run_would_create": 0,
            "dry_run_would_link": 0,
            "existing_google_linked": 0,
            "existing_google_unlinked": 0,
            "skipped_no_email": 0,
            "skipped_multi_match": 0,
            "errors": 0,
        }

        self.stdout.write(
            f"Target providers={','.join(providers)} apply={apply} email_verified={email_verified} "
            f"set_login_provider_keycloak={set_login_provider_keycloak}"
        )

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

                    federated = self._get_user_federated_provider_aliases(
                        server_url=server_url,
                        realm=target_realm,
                        token=access_token,
                        keycloak_user_id=kc_id,
                    )
                    has_google_federated = "google" in federated
                    if has_google_federated:
                        stats["existing_google_linked"] += 1
                    else:
                        stats["existing_google_unlinked"] += 1
                    federated_label = ",".join(federated) if federated else "-"

                    if apply:
                        self._link_local_user(
                            user,
                            kc_id,
                            set_login_provider_keycloak=set_login_provider_keycloak,
                        )
                        stats["linked_existing"] += 1
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"[linked] user={user.username} email={email} keycloak_sub={kc_id} "
                                f"federated={federated_label} google_linked={has_google_federated}"
                            )
                        )
                    else:
                        stats["dry_run_would_link"] += 1
                        self.stdout.write(
                            f"[dry-run:link] user={user.username} email={email} keycloak_sub={kc_id} "
                            f"federated={federated_label} google_linked={has_google_federated}"
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
                    email_verified=email_verified,
                )
                if not created_id:
                    raise RuntimeError("create user succeeded but user id was not found")

                self._link_local_user(
                    user,
                    created_id,
                    set_login_provider_keycloak=set_login_provider_keycloak,
                )
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
            f"dry_run_would_link={stats['dry_run_would_link']} "
            f"dry_run_would_create={stats['dry_run_would_create']} "
            f"existing_google_linked={stats['existing_google_linked']} "
            f"existing_google_unlinked={stats['existing_google_unlinked']} "
            f"skipped_no_email={stats['skipped_no_email']} "
            f"skipped_multi_match={stats['skipped_multi_match']} "
            f"errors={stats['errors']}"
        )
        self.stdout.write(self.style.SUCCESS(summary))

    @staticmethod
    def _parse_providers(raw_value):
        normalized = []
        seen = set()
        for item in (raw_value or "").split(","):
            provider = item.strip().lower()
            if not provider or provider in seen:
                continue
            seen.add(provider)
            normalized.append(provider)
        return normalized

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

    def _get_user_federated_provider_aliases(self, server_url, realm, token, keycloak_user_id):
        if not keycloak_user_id:
            return []
        url = f"{server_url}/admin/realms/{realm}/users/{keycloak_user_id}/federated-identity"
        body, _ = self._request_json(method="GET", url=url, token=token)
        if not isinstance(body, list):
            return []

        providers = []
        for entry in body:
            if not isinstance(entry, dict):
                continue
            alias = str(entry.get("identityProvider") or "").strip().lower()
            if alias:
                providers.append(alias)
        return sorted(set(providers))

    @staticmethod
    def _safe_username(user):
        username = (user.username or "").strip()
        if username:
            return username
        email = (user.email or "").strip()
        if email and "@" in email:
            return email.split("@", 1)[0]
        return f"social_{str(user.id)[:8]}"

    def _create_keycloak_user(self, server_url, realm, token, user, email_verified):
        email = (user.email or "").strip()
        payload = {
            "username": self._safe_username(user),
            "email": email if email else None,
            "enabled": bool(user.is_active),
            "firstName": user.first_name or "",
            "lastName": user.last_name or "",
            "emailVerified": bool(email_verified),
            "attributes": {
                "legacy_user_id": [str(user.id)],
                "legacy_login_provider": [user.login_provider or "social"],
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

    @staticmethod
    def _link_local_user(user, keycloak_sub, set_login_provider_keycloak=False):
        user.keycloak_sub = keycloak_sub
        update_fields = ["keycloak_sub"]
        if set_login_provider_keycloak:
            user.login_provider = "keycloak"
            update_fields.append("login_provider")
        user.save(update_fields=update_fields)
