# Stage 1: build the React app
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: FastAPI serving the API and the built app
FROM python:3.12-slim
WORKDIR /srv
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY --from=web /web/dist ./frontend/dist
WORKDIR /srv/backend
ENV COOKIE_SECURE=true
# SQLite lives in /srv/backend/data -> mount a persistent volume there (or set DATABASE_URL)
VOLUME /srv/backend/data
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
