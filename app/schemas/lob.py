# app/schemas/lob.py
from pydantic import BaseModel, field_validator, Field
from typing import Dict, Any, Optional, Literal
from datetime import datetime


class OllamaAdvancedSettings(BaseModel):
    """Granular inference parameters for Ollama models."""
    temperature: float = Field(default=0.0, ge=0.0, le=2.0, description="Creatividad del modelo. 0.0 es determinista.")
    top_p: float = Field(default=0.9, ge=0.0, le=1.0, description="Nucleus sampling.")
    top_k: int = Field(default=40, ge=0, description="Limitación de tokens probables.")
    repeat_penalty: float = Field(default=1.15, ge=1.0, le=2.0, description="Penalización por repetición.")
    num_ctx: int = Field(default=8192, ge=2048, le=128000, description="Ventana de contexto (impacto en VRAM).")
    num_predict: int = Field(default=2048, ge=1, description="Máximo de tokens a generar.")
    seed: Optional[int] = Field(default=42, description="Semilla determinista para reproducibilidad.")
    auto_context: bool = Field(default=False, description="Ajuste automático de num_ctx basado en el texto de entrada.")


class LLMConfig(BaseModel):
    """Schema for LLM provider configuration per LOB."""
    provider: Literal["ollama", "openai", "grok", "gemini", "claude"] = Field("ollama", description="The AI provider for this LOB", examples=["openai"])
    model: str = Field("llama3.1:8b", description="The specific model name to use", examples=["gpt-4o"])
    api_key: Optional[str] = Field(None, description="API Key for the provider (stored encrypted)", examples=["sk-proj-..."])
    api_base: Optional[str] = Field(None, description="Custom API base URL (optional)", examples=["https://api.openai.com/v1"])
    stt_model: str = Field("small", description="The Faster-Whisper model size for this LOB", examples=["medium"])
    advanced_settings: Optional[OllamaAdvancedSettings] = Field(default=None, description="Advanced inference settings for Ollama")

    @field_validator("provider")
    @classmethod
    def validate_provider(cls, v: str) -> str:
        valid = {"ollama", "openai", "grok", "gemini", "claude"}
        if v not in valid:
            raise ValueError(f"Invalid provider '{v}'. Must be one of: {', '.join(valid)}")
        return v


class LLMTestRequest(BaseModel):
    """Schema for testing an LLM connection and saving config."""
    provider: str = Field(..., description="Provider name", examples=["ollama"])
    model: str = Field(..., description="Model name", examples=["llama3.1:8b"])
    api_key: Optional[str] = Field(None, description="API Key for testing")
    api_base: Optional[str] = Field(None, description="Custom API base URL")
    stt_model: Optional[str] = Field("small", description="STT model size for testing")
    advanced_settings: Optional[OllamaAdvancedSettings] = Field(default=None, description="Advanced inference settings")


class LOBBase(BaseModel):
    name: str = Field(..., description="The name of the Line of Business", examples=["Customer Support", "Sales"])
    tenant_id: Optional[int] = Field(None, description="The tenant ID this LOB belongs to", examples=[1])
    system_prompt: str = Field(..., description="The system prompt for AI evaluation", examples=["You are a helpful assistant..."])
    criteria_json: Dict[str, Any] = Field(..., description="JSON object containing evaluation criteria", examples=[{"greeting": {"question": "Did the agent greet?", "points": 10}}])
    is_active: bool = Field(False, description="Whether this LOB is currently active")


class LOBCreate(LOBBase):
    pass


class LOBUpdate(BaseModel):
    name: Optional[str] = Field(None, description="New name for the LOB")
    system_prompt: Optional[str] = Field(None, description="New system prompt")
    criteria_json: Optional[Dict[str, Any]] = Field(None, description="Updated criteria JSON")
    is_active: Optional[bool] = Field(None, description="New active status")


class LOBResponse(LOBBase):
    id: int = Field(..., description="Unique LOB identifier", examples=[1])
    is_builtin: bool = Field(..., description="Whether this is a system-provided LOB")
    created_at: datetime = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "General Support",
                "tenant_id": 1,
                "system_prompt": "Evaluate call center etiquette...",
                "criteria_json": {
                    "greeting": {"question": "Did the agent say hello?", "points": 5, "mandatory": True}
                },
                "is_active": True,
                "is_builtin": False,
                "created_at": "2024-01-01T12:00:00"
            }
        }
