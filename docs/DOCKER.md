# Docker Deployment Guide

This guide covers deploying the AI Voice Audit platform using Docker Compose.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- NVIDIA GPU with CUDA support (for optimal STT performance)
- NVIDIA Container Toolkit installed (for GPU passthrough)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/AlonsoRodriguez-Am/ai-voice-audit.git
cd ai-voice-audit
```

### 2. Configure Environment

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Edit `.env` with your secure values:

```env
# Database Configuration
DB_NAME=call_center_qa
DB_USER=postgres
DB_PASS=your_secure_password_here
DB_HOST=db
DB_PORT=5432

# Ollama Configuration
OLLAMA_HOST=http://ollama:11434
LLM_MODEL=llama3.1:8b

# JWT Authentication
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this

# Default Admin
DEFAULT_ADMIN_PASSWORD=change_this_password

# Host Ports (optional, defaults shown)
HOST_APP_PORT=5001
HOST_DB_PORT=5433
```

### 3. Start All Services

```bash
docker-compose up -d
```

This starts 7 services:
- **app** - FastAPI backend
- **frontend** - React dev server
- **db** - PostgreSQL
- **redis** - Celery broker
- **celery_worker** - Background tasks
- **flower** - Celery monitoring
- **ollama** - Local LLM

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **API Documentation**: http://localhost:5001/docs
- **Flower Monitoring**: http://localhost:5555
- **Ollama API**: http://localhost:11434

## Service Details

### app (FastAPI Backend)

- **Internal Port**: 5000
- **Host Port**: 5001 (configurable via `HOST_APP_PORT`)
- **Purpose**: REST API server
- **Dependencies**: db, redis, ollama

Environment variables:
- `CELERY_BROKER_URL` - Redis connection string
- `CELERY_RESULT_BACKEND` - Redis connection string
- `OLLAMA_HOST` - Ollama service URL

### frontend (React SPA)

- **Port**: 5173
- **Purpose**: Development server with HMR
- **Dependencies**: app

Environment variables:
- `VITE_API_BASE_URL` - Backend API URL

### db (PostgreSQL)

- **Internal Port**: 5432
- **Host Port**: 5433 (configurable via `HOST_DB_PORT`)
- **Volume**: `postgres_data` for persistence
- **Image**: postgres:17

### redis

- **Port**: 6379
- **Purpose**: Celery message broker and result backend
- **Image**: redis:7-alpine
- **Volume**: No persistence (ephemeral)

### celery_worker

- **Purpose**: Asynchronous task processing (audio transcription, LLM analysis)
- **Dependencies**: db, redis, ollama
- **GPU**: Requires NVIDIA runtime for Whisper

### flower

- **Port**: 5555
- **Purpose**: Celery monitoring dashboard
- **Credentials**: None by default (configure in production)

### ollama

- **Port**: 11434
- **Purpose**: Local LLM server
- **Volume**: `ollama_data` for model cache
- **GPU**: Requires NVIDIA runtime

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f app
docker-compose logs -f celery_worker
```

### Restart Services

```bash
docker-compose restart app
docker-compose restart celery_worker
```

### Stop Services

```bash
docker-compose stop
```

### Stop and Remove Containers

```bash
docker-compose down
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

### Access Container Shell

```bash
docker-compose exec app bash
docker-compose exec db psql -U postgres
```

## Database Management

### Run Migrations

Migrations run automatically on startup. To manually run:

```bash
docker-compose exec app alembic upgrade head
```

### Create New Migration

```bash
docker-compose exec app alembic revision -m "description"
```

### Seed Database

The database is automatically seeded on first startup with:
- Default admin user (password from `DEFAULT_ADMIN_PASSWORD`)
- Sample LOBs

## Ollama Model Management

### Pull a Model

```bash
docker-compose exec ollama ollama pull llama3.1:8b
```

### List Models

```bash
docker-compose exec ollama ollama list
```

### Use Different Model

Update `.env`:
```env
LLM_MODEL=llama3.2:3b
```

Then restart:
```bash
docker-compose up -d --build
```

## Troubleshooting

### GPU Not Detected

Ensure NVIDIA Container Toolkit is installed:
```bash
docker run --runtime=nvidia --rm nvidia/cuda:11.0-base nvidia-smi
```

### Port Already in Use

Change host ports in `.env`:
```env
HOST_APP_PORT=5002
HOST_DB_PORT=5434
```

### Database Connection Error

Check if PostgreSQL is ready:
```bash
docker-compose logs db | grep "ready to accept connections"
```

### Celery Worker Not Processing

Check Flower dashboard at http://localhost:5555 or worker logs:
```bash
docker-compose logs -f celery_worker
```

## Production Considerations

⚠️ **This setup is for development/testing. For production:**

1. **Change all default passwords and secrets**
2. **Enable authentication for Flower**
3. **Use a production WSGI server instead of Vite dev server**
4. **Configure proper CORS origins**
5. **Set up SSL/TLS certificates**
6. **Use Docker secrets or vault for sensitive data**
7. **Configure log rotation**
8. **Set up health checks**
9. **Use a production PostgreSQL setup with backups**
