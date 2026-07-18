# AI Voice Audit - Architecture Documentation

## Overview

The AI Voice Audit platform uses a containerized, multi-tenant architecture with clear separation between frontend, backend, and background processing services.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                            │
│                    (React 19 + Vite 8 SPA)                    │
└───────────────────────────┬───────────────────────────────────┘
                            │ HTTP/WS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (:5000)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Auth    │  │  Users   │  │  LOBs    │  │  Tenants │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ Evaluat. │  │ Reports  │  │Dashboard │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│  ┌─────────────────────────────────────────────────────┐     │
│  │    TenantContextMiddleware (Multi-Tenancy)          │     │
│  └─────────────────────────────────────────────────────┘     │
└──────────────┬─────────────────────────┬─────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  PostgreSQL (:5433)  │    │   Celery + Redis (:6379) │
│  ┌────────────────┐  │    │   ┌──────────────────┐   │
│  │ Tenants        │  │    │   │ Evaluation Tasks  │   │
│  │ Users          │  │    │   │ - Transcription   │   │
│  │ LOBs           │  │    │   │ - LLM Analysis    │   │
│  │ Evaluations    │  │    │   │ - Status Updates   │   │
│  │ TokenBlacklist │  │    │   └──────────────────┘   │
│  │ LLMAuditLog    │  │    └──────────────────────────┘
│  │ PIIAuditLog    │  │
│  └────────────────┘  │
└──────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│              Local AI Processing (GPU Required)              │
│  ┌──────────────────┐    ┌─────────────────────────────┐  │
│  │ Faster-Whisper   │    │ Ollama (Llama 3.1:8b)      │  │
│  │ - large-v3 model │    │ - Local LLM inference       │  │
│  │ - CUDA accel.    │    │ - Quality analysis          │  │
│  └──────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Multi-Tenancy

### Tenant Isolation
Each tenant has complete data isolation:
- Users belong to a specific tenant
- LOBs are tenant-scoped
- Evaluations are filtered by tenant_id
- PII configuration is per-tenant

### Tenant Context Middleware
Located in `app/core/tenant_context.py`:
1. Extracts tenant ID from JWT token or request headers
2. Sets tenant context for the request lifecycle
3. All database queries automatically filter by tenant_id

### Tenant Configuration
Each tenant can configure:
- PII redaction rules (enabled types, redaction token)
- Custom evaluation settings
- LLM provider preferences per LOB

## Background Processing

### Celery Workers
- **Purpose**: Asynchronous audio processing
- **Broker**: Redis 7
- **Result Backend**: Redis 7
- **Concurrency**: 1 worker (GPU-intensive tasks)

### Task Flow
1. User uploads audio file via API
2. API creates Evaluation record with "pending" status
3. Celery task enqueued to Redis
4. Worker picks up task and:
   - Transcribes audio using Faster-Whisper
   - Sends transcript to LLM for analysis
   - Updates Evaluation record with results
5. Frontend polls for status updates or receives WebSocket notification

### Monitoring
- **Flower** (:5555) provides real-time monitoring of:
  - Active tasks
  - Task history
  - Worker status
  - Queue lengths

## Database Schema

### Core Entities

#### Tenant
- id, name, slug
- settings (JSONB) - Custom configurations
- pii_config (JSONB) - PII redaction settings

#### User
- id, email, hashed_password
- role (admin, manager, analyst)
- tenant_id (foreign key)

#### LOB (Line of Business)
- id, name, description
- evaluation_criteria (JSONB)
- llm_provider, llm_model, llm_api_base
- tenant_id (foreign key)

#### Evaluation
- id, audio_filename, duration
- transcript, llm_analysis (JSONB)
- final_score, status
- user_id, lob_id, tenant_id (foreign keys)

#### LLMAuditLog
- Tracks AI performance
- Records human corrections
- Links to evaluation

#### PIIAuditLog
- Records PII redactions
- Links to evaluation
- Configurable audit trail

## Docker Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| app | Local build | 5000 → 5001 | FastAPI backend |
| frontend | frontend build | 5173 | Vite dev server |
| db | postgres:17 | 5433 | PostgreSQL database |
| redis | redis:7-alpine | 6379 | Celery broker |
| celery_worker | Local build | - | Background tasks |
| flower | mher/flower | 5555 | Celery monitoring |
| ollama | ollama/ollama | 11434 | Local LLM server |

## Security Architecture

### Authentication
- JWT tokens (HS256 algorithm)
- Access token (short-lived) + Refresh token (long-lived)
- Token blacklisting for logout

### Authorization
- Role-Based Access Control (RBAC)
- Roles: admin, manager, analyst
- Tenant-level isolation

### PII Protection
- Configurable redaction per tenant
- Supported types: phone, email, SSN, credit_card, names
- Audit logging of all redactions
- AES-256 encryption for external API keys

## API Structure

All API endpoints are prefixed with `/api`:
- `/api/auth/*` - Authentication endpoints
- `/api/users/*` - User management
- `/api/lobs/*` - LOB management
- `/api/evaluations/*` - Evaluation processing
- `/api/reports/*` - Report generation
- `/api/dashboard/*` - Analytics and metrics
- `/api/tenants/*` - Tenant administration (admin only)

## Frontend Architecture

### Technology Stack
- React 19 with TypeScript
- Vite 8 for build tooling
- Tailwind CSS 4 for styling
- React Router 7 for navigation
- TanStack Query for state management

### Component Organization
- `components/ui/` - Reusable primitives
- `components/charts/` - Visualization components
- `pages/` - Page-level components
- `context/` - React contexts (Auth)
- `api/` - API client configuration
