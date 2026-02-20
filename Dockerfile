# --- Frontend Build Stage ---
FROM node:20 AS fe-build
WORKDIR /app/frontend

# 의존성 먼저 복사 → 캐시
COPY frontend/package*.json ./
RUN npm ci

# Build-time frontend envs (public Vite vars)
ARG VITE_API_BASE=/api
ARG VITE_PERSIST_LOGIN=false
ENV VITE_API_BASE=$VITE_API_BASE
ENV VITE_PERSIST_LOGIN=$VITE_PERSIST_LOGIN

# 소스 복사 + 빌드 (Vite 기준 dist)
COPY frontend/ .
RUN npm run build

# --- App Runtime (Django + built frontend; nginx separated) ---
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# 시스템 패키지 설치 (nginx 제외)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential libpq-dev python3-dev default-libmysqlclient-dev pkg-config \
 && rm -rf /var/lib/apt/lists/*

# 파이썬 의존성
COPY backend/requirements.txt .
RUN pip install --no-cache-dir uv \
 && uv pip install --system --no-cache-dir -r requirements.txt

# django 소스 복사
COPY backend/ .

# 프론트 빌드 산출물 포함 (nginx 컨테이너에 볼륨으로 공유)
COPY --from=fe-build /app/frontend/dist /opt/frontend-dist

# 엔트리포인트 (collectstatic + 프론트 sync + gunicorn)
COPY deploy/backend-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# 정적/미디어 경로(collectstatic/업로드용)
RUN mkdir -p /var/www/static /shared/frontend

EXPOSE 8000
CMD ["/entrypoint.sh"]
