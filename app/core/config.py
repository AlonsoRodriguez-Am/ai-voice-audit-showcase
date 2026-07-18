import os
from typing import Optional
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load .env file before Settings is instantiated
load_dotenv()

class Settings(BaseSettings):
    # Database
    DB_NAME: str = "audit_db"
    DB_USER: str = "postgres"
    DB_PASS: str = "postgres"
    DB_HOST: str = "localhost"
    DB_PORT: str = "5432"

    # Local LLM (vLLM)
    LOCAL_LLM_API_BASE: str = "http://localhost:8899/v1"
    LOCAL_LLM_MODEL: str = "hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4"

    # JWT (required — no defaults for security)
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    DEFAULT_ADMIN_PASSWORD: str = "admin123"

    # API Keys
    OPENAI_API_KEY: Optional[str] = None
    GROK_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    CLAUDE_API_KEY: Optional[str] = None
    ENCRYPTION_KEY: Optional[str] = None

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/0"
    CELERY_STT_QUEUE_NAME: str = "stt_queue"
    CELERY_LLM_QUEUE_NAME: str = "llm_queue"

    @property
    def REDIS_URL(self) -> str:
        return self.CELERY_BROKER_URL

    # Infrastructure (for docker-compose)
    HOST_DB_PORT: Optional[str] = None
    HOST_APP_PORT: Optional[str] = None

    @property
    def DATABASE_URL(self) -> str:
        host = self.DB_HOST
        port = self.DB_PORT
        # If DB_HOST is set to 'db' but we are not inside Docker (cannot resolve 'db'),
        # automatically fallback to 'localhost' and map to HOST_DB_PORT
        if host == "db":
            import socket
            try:
                socket.gethostbyname("db")
            except socket.gaierror:
                host = "localhost"
                if self.HOST_DB_PORT:
                    port = self.HOST_DB_PORT
                else:
                    port = "5433"
        return f"postgresql://{self.DB_USER}:{self.DB_PASS}@{host}:{port}/{self.DB_NAME}"

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()

# Propagate LOCAL_LLM_API_BASE so standard clients pick it up if needed
if settings.LOCAL_LLM_API_BASE:
    os.environ["OPENAI_BASE_URL"] = settings.LOCAL_LLM_API_BASE
