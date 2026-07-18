from sqlalchemy import Column, Integer, String, TIMESTAMP, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    settings = Column(JSONB, server_default='{}')
    pii_config = Column(JSONB, server_default='{"enabled": true, "enabled_types": ["phone", "email", "ssn", "credit_card"], "redaction_token": "***REDACTED***", "log_redactions": true, "names_enabled": false}')
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    users = relationship("User", back_populates="tenant")
    lobs = relationship("LOB", back_populates="tenant")
    evaluations = relationship("Evaluation", back_populates="tenant")
