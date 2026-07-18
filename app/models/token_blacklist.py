from sqlalchemy import Column, Integer, Text, TIMESTAMP, text
from app.core.database import Base


class TokenBlacklist(Base):
    __tablename__ = "token_blacklist"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(Text, unique=True, nullable=False)
    blacklisted_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
