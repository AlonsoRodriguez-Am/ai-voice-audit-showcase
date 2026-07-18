from sqlalchemy import Column, Integer, String, DateTime, Float
from datetime import datetime
from app.core.database import Base

class TokenUsage(Base):
    __tablename__ = "token_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    model_name = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
