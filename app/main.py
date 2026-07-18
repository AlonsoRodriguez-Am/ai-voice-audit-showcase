from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from contextlib import asynccontextmanager
import os

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi import status

from app.core.database import engine, Base, SessionLocal
from app.core.seed import seed_db
from app.core.init_models import initialize_ollama_host

# Import all models so Base.metadata.create_all() picks them up
from app.models import user, lob, evaluation, token_blacklist  # noqa: F401

from app.api.routers import auth, users, lobs, evaluations, reports, dashboard, tenants, analytics, telemetry, diagnostics


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle for the FastAPI application."""
    # Initialize AI models (Only Ollama host is needed for the API to check connections)
    print("Initializing AI models...")
    initialize_ollama_host()

    # Run database migrations using Alembic
    print("Running database migrations...")
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
    print("Migrations applied successfully.")

    # Seed Database
    db = SessionLocal()
    seeded_users = []
    try:
        seeded_users = seed_db(db)
    finally:
        db.close()

    host_port = os.getenv("HOST_APP_PORT", "5001")
    print("\n" + "="*70)
    print("🚀 AI Voice Audit API Server has started successfully!")
    print(f"📡 API is available at:       http://localhost:{host_port}")
    print(f"🖥️  Frontend is available at: http://localhost:5173")
    print("-" * 70)
    print("🔑 SEEDED USERS:")
    for su in seeded_users:
        print(f"   - {su['role']:<15} | Email: {su['email']:<18} | Pass: {su['password']}")
    print("="*70 + "\n")
    yield

    print("Shutting down...")


tags_metadata = [
    {"name": "auth", "description": "Operations for user authentication and session management."},
    {"name": "users", "description": "Operations for user management and profile settings."},
    {"name": "lobs", "description": "Operations for Lines of Business (LOB) configuration."},
    {"name": "evaluations", "description": "Operations for audio transcription and AI analysis."},
    {"name": "reports", "description": "Operations for generating and exporting analysis reports."},
    {"name": "dashboard", "description": "Operations for fetching high-level metrics and trends."},
    {"name": "tenants", "description": "Operations for tenant and multi-tenancy configuration."},
    {"name": "health", "description": "Basic API health and status checks."},
]

description = """
AI Voice Audit API provides a robust set of endpoints for automating the quality assurance process in call centers using advanced AI models.

## Key Features
- **Asynchronous Audio Processing**: Upload call recordings for transcription and AI-powered evaluation.
- **Dynamic LLM Selection**: Configure specific AI models per Line of Business (LOB).
- **Multi-Tenancy**: Secure data isolation and tenant-specific configurations.
- **Advanced Analytics**: Real-time dashboards and exportable reports.

## Authentication
This API uses **JWT tokens** for secure authentication. 
1. Obtain tokens via the `/api/auth/login` endpoint.
2. Include the access token in the `Authorization` header for all protected endpoints:
   `Authorization: Bearer <your_access_token>`
"""

app = FastAPI(
    title="AI Voice Audit API",
    description=description,
    version="1.0.0",
    openapi_tags=tags_metadata,
    lifespan=lifespan,
    swagger_ui_parameters={"tryItOutEnabled": True, "displayRequestDuration": True},
)

# Exception Handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"success": False, "detail": exc.errors()},
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "detail": "Internal Server Error", "message": str(exc)},
    )


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

from app.core.tenant_context import TenantContextMiddleware
app.add_middleware(TenantContextMiddleware)

# Include Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(lobs.router)
app.include_router(evaluations.router, prefix="/api/evaluation", tags=["evaluations"])
app.include_router(reports.router)
app.include_router(dashboard.router)
app.include_router(tenants.router)
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(telemetry.router, prefix="/api/telemetry", tags=["telemetry"])
app.include_router(diagnostics.router, prefix="/api/diagnostics", tags=["diagnostics"])


@app.get("/api/health", tags=["health"])
def read_root():
    return {"message": "AI Voice Audit API is running"}


@app.get("/", tags=["health"], include_in_schema=False)
def api_root():
    return {
        "message": "AI Voice Audit API",
        "docs": "/docs",
        "health": "/api/health",
        "frontend": "http://localhost:5173",
    }
