# --- Frontend Build Stage ---
FROM node:20 AS fe-build
WORKDIR /app/frontend
RUN rm -rf /var/www/html/*

# 의존성 먼저 복사 → 캐시
COPY frontend/package*.json ./
RUN npm ci

# 소스 복사 + 빌드 (Vite 기준 dist)
COPY frontend/ .
RUN npm run build

# --- Backend Runtime (Python + nginx + supervisor) ---
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app

# 시스템 패키지 설치 (nginx 포함) — supervisor는 pip로 설치(구버그 회피)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential libpq-dev python3-dev default-libmysqlclient-dev pkg-config \
      nginx \
 && rm -rf /var/lib/apt/lists/*

# supervisor 최신 설치
RUN pip install --no-cache-dir --upgrade supervisor

# 파이썬 의존성
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# django, react 소스 복사
COPY backend/ .
COPY --from=fe-build /app/frontend/build /usr/share/nginx/html
# 권한 보정
RUN chown -R www-data:www-data /usr/share/nginx/html || true \
 && chmod -R a+rX /usr/share/nginx/html

RUN rm -f /etc/nginx/sites-enabled/default \
    && rm -f /etc/nginx/conf.d/default.conf

# 설정/엔트리포인트
COPY deploy/nginx.conf       /etc/nginx/conf.d/default.conf
COPY deploy/supervisord.conf /etc/supervisor/supervisord.conf
COPY deploy/entrypoint.sh    /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 정적/미디어 경로(collectstatic/업로드용)
RUN mkdir -p /var/www/static /var/www/media

EXPOSE 8080
CMD ["/entrypoint.sh"]