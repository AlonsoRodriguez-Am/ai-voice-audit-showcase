from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import contextvars

# Context variable to store tenant_id per request
tenant_id_context = contextvars.ContextVar("tenant_id", default=None)

class TenantContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Extract tenant_id from JWT token (already validated by OAuth2)
        # The tenant_id is available via get_current_tenant() dependency
        # This middleware sets context for ORM-level filtering if required.
        
        response = await call_next(request)
        return response

def get_current_tenant_id() -> int | None:
    """Get tenant_id from context (set by dependencies)."""
    return tenant_id_context.get()

def set_current_tenant_id(tenant_id: int | None):
    """Set tenant_id in context."""
    tenant_id_context.set(tenant_id)
