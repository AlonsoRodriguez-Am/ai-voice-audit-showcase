# Multi-Tenancy Documentation

## Overview

The AI Voice Audit platform supports multi-tenancy, allowing multiple organizations (tenants) to use the same application instance while maintaining complete data isolation.

## Architecture

### Tenant Isolation Model

```
┌─────────────────────────────────────────────┐
│              Request Incoming                │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│        TenantContextMiddleware              │
│  - Extract tenant_id from JWT or header    │
│  - Set tenant context for request           │
└─────────────────────┬───────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────┐
│           Database Query Layer              │
│  - All queries filtered by tenant_id        │
│  - Automatic isolation enforcement          │
└─────────────────────┬───────────────────────┘
                      │
          ┌───────────┴───────────┐
          ▼                       ▼
┌─────────────────┐       ┌─────────────────┐
│   Tenant A      │       │   Tenant B      │
│  - Users        │       │  - Users        │
│  - LOBs         │       │  - LOBs         │
│  - Evaluations  │       │  - Evaluations  │
└─────────────────┘       └─────────────────┘
```

## Tenant Model

Located in `app/models/tenant.py`:

```python
class Tenant(Base):
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    settings = Column(JSONB, server_default='{}')
    pii_config = Column(JSONB, server_default='{...}')
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    lobs = relationship("LOB", back_populates="tenant")
    evaluations = relationship("Evaluation", back_populates="tenant")
```

### Tenant Settings (JSONB)

Custom configuration per tenant:
```json
{
  "theme": "dark",
  "logo_url": "https://...",
  "custom_fields": {...}
}
```

### PII Configuration (JSONB)

Per-tenant PII redaction settings:
```json
{
  "enabled": true,
  "enabled_types": ["phone", "email", "ssn", "credit_card"],
  "redaction_token": "***REDACTED***",
  "log_redactions": true,
  "names_enabled": false
}
```

## Tenant Context Middleware

Located in `app/core/tenant_context.py`:

### How It Works

1. **Extract Tenant ID**:
   - From JWT token (`tenant_id` claim)
   - From request header (`X-Tenant-ID`)
   - From query parameter (fallback, for admin use)

2. **Set Context**:
   ```python
   from app.core.tenant_context import TenantContext
   
   TenantContext.set_current_tenant(tenant_id)
   ```

3. **Query Filtering**:
   All database queries automatically include:
   ```python
   query = query.filter(Model.tenant_id == TenantContext.get_current_tenant())
   ```

### Implementation

```python
class TenantContextMiddleware:
    async def __call__(self, request: Request, call_next):
        # Extract tenant ID
        tenant_id = self._extract_tenant_id(request)
        
        # Set context
        TenantContext.set_current_tenant(tenant_id)
        
        try:
            response = await call_next(request)
            return response
        finally:
            TenantContext.clear()
```

## API Endpoints

### Tenant Management (Admin Only)

- `POST /api/tenants/` - Create new tenant
- `GET /api/tenants/` - List all tenants
- `GET /api/tenants/{id}` - Get tenant details
- `PUT /api/tenants/{id}` - Update tenant
- `DELETE /api/tenants/{id}` - Delete tenant

### Tenant Settings

- `GET /api/tenants/{id}/settings` - Get settings
- `PUT /api/tenants/{id}/settings` - Update settings
- `PUT /api/tenants/{id}/pii-config` - Update PII config

## User Belongs to Tenant

Users are associated with a tenant at creation:

```python
class User(Base):
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    role = Column(Enum(UserRole), default=UserRole.analyst)
    
    tenant = relationship("Tenant", back_populates="users")
```

### JWT Token Includes Tenant

When a user logs in, the JWT token includes:
```json
{
  "sub": "user_id",
  "email": "user@tenant.com",
  "role": "manager",
  "tenant_id": 1,
  "tenant_slug": "acme-corp"
}
```

## LOB and Evaluation Isolation

### Line of Business (LOB)

LOBs belong to a tenant:
```python
class LOB(Base):
    id = Column(Integer, primary_key=True)
    name = Column(String(255))
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    
    tenant = relationship("Tenant", back_populates="lobs")
```

### Evaluations

Evaluations are triple-scoped:
```python
class Evaluation(Base):
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    lob_id = Column(Integer, ForeignKey("lobs.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    
    tenant = relationship("Tenant", back_populates="evaluations")
```

## PII Redaction

### Configuration

Each tenant can configure PII redaction:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | true | Enable/disable PII redaction |
| `enabled_types` | array | ["phone","email","ssn","credit_card"] | PII types to redact |
| `redaction_token` | string | "***REDACTED***" | Replacement text |
| `log_redactions` | boolean | true | Log redactions to PIIAuditLog |
| `names_enabled` | boolean | false | Enable name redaction (experimental) |

### Supported PII Types

- **phone** - Phone numbers
- **email** - Email addresses
- **ssn** - Social Security Numbers
- **credit_card** - Credit card numbers
- **names** - Person names (optional, experimental)

### Audit Logging

When `log_redactions` is enabled, all redactions are logged:

```python
class PIIAuditLog(Base):
    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"))
    pii_type = Column(String(50))
    original_value = Column(Text)  # Hashed in production
    created_at = Column(TIMESTAMP)
```

## Switching Tenants (Admin)

Super-admins can switch between tenants:

1. **Via Header**:
   ```bash
   curl -H "X-Tenant-ID: 2" -H "Authorization: Bearer <token>" \
        http://localhost:5000/api/evaluations/
   ```

2. **Via Query Parameter** (admin only):
   ```bash
   curl "http://localhost:5000/api/evaluations/?tenant_id=2" \
        -H "Authorization: Bearer <token>"
   ```

## Database Migrations

When adding new tenant-scoped models, ensure:
1. Add `tenant_id` column
2. Add foreign key to `tenants.id`
3. Add index on `tenant_id` for performance
4. Update relationships

Example migration:
```python
def upgrade():
    op.add_column('new_table', sa.Column('tenant_id', sa.Integer(), nullable=False))
    op.create_foreign_key('fk_new_table_tenant', 'new_table', 'tenants', ['tenant_id'], ['id'])
    op.create_index('idx_new_table_tenant_id', 'new_table', ['tenant_id'])
```

## Best Practices

1. **Always use TenantContext** - Never bypass tenant filtering
2. **Test with multiple tenants** - Ensure isolation works
3. **Log tenant_id** - Include in all audit logs
4. **Index tenant_id** - All tenant-scoped tables need indexes
5. **Validate tenant access** - Check user belongs to requested tenant
6. **Secure PII logs** - Hash or encrypt original values in PIIAuditLog
