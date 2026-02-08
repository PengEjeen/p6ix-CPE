#!/usr/bin/env sh
set -e

mkdir -p /var/www/static /shared/frontend

# Django static (for /django-static/)
python manage.py collectstatic --noinput || true

# Sync built SPA into shared volume for nginx (mounted at /usr/share/nginx/html in nginx container)
if [ -d /opt/frontend-dist ] && [ -d /shared/frontend ]; then
  rm -rf /shared/frontend/*
  cp -a /opt/frontend-dist/. /shared/frontend/
fi

exec gunicorn backend.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-3}" \
  --timeout "${GUNICORN_TIMEOUT:-120}"

