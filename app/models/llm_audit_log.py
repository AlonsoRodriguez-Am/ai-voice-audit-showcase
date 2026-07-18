from sqlalchemy import Column, Integer, String, TIMESTAMP, ForeignKey, func, Text
from app.core.database import Base

class LLMAuditLog(Base):
    __tablename__ = "llm_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    lob_id = Column(Integer, ForeignKey("lobs.id"), nullable=False)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(50), nullable=False)  # "CONFIG_UPDATED", "API_KEY_ROTATED"
    old_provider = Column(String(50))
    new_provider = Column(String(50))
    timestamp = Column(TIMESTAMP, server_default=func.now())
    details = Column(Text)  # JSON with changes (NO API keys!)
