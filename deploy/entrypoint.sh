#!/usr/bin/env bash
set -e

# 정적/미디어 디렉터리만 생성
mkdir -p /var/www/static /var/www/media

# collectstatic
python manage.py collectstatic --noinput || true

# Nginx + Gunicorn 실행
exec $(which supervisord) -c /etc/supervisor/supervisord.conf
