from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, func
from app.core.database import Base

class PIIAuditLog(Base):
    __tablename__ = "pii_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), nullable=False)
    redacted_type = Column(String(50), nullable=False)  # phone, email, etc.
    redacted_value_hash = Column(String(64), nullable=False)  # Hash of the redacted value
    redacted_at = Column(TIMESTAMP, server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Who uploaded the audio
