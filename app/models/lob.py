from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class LOB(Base):
    __tablename__ = "lobs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    name = Column(String(255), unique=True, nullable=False)
    system_prompt = Column(Text, nullable=False)
    criteria_json = Column(JSONB, nullable=False)
    is_builtin = Column(Boolean, server_default="FALSE")
    is_active = Column(Boolean, server_default="FALSE")
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))

    # Relationships
    tenant = relationship("Tenant", back_populates="lobs")
    evaluations = relationship("Evaluation", back_populates="lob")
