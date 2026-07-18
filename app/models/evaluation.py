from sqlalchemy import Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey, text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    call_id = Column(String(255))
    full_transcript = Column(Text)
    detected_language = Column(String(50))
    topics = Column(Text)
    ttca_seconds = Column(Integer)
    ttch_seconds = Column(Integer)
    final_score = Column(Integer)
    evaluation_date = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
    had_error = Column(Boolean, server_default="FALSE")
    error_message = Column(Text)

    # AI Predictions (answers)
    greeting_ai = Column(String(10))
    hipaa_verification_ai = Column(String(10))
    resolve_concern_ai = Column(String(10))
    pci_compliance_ai = Column(String(10))
    call_closing_ai = Column(String(10))
    professionalism_ai = Column(String(10))
    call_management_ai = Column(String(10))
    documentation_ai = Column(String(10))

    # AI Reasoning
    greeting_reasoning = Column(Text)
    hipaa_verification_reasoning = Column(Text)
    resolve_concern_reasoning = Column(Text)
    pci_compliance_reasoning = Column(Text)
    call_closing_reasoning = Column(Text)
    professionalism_reasoning = Column(Text)
    call_management_reasoning = Column(Text)
    documentation_reasoning = Column(Text)

    # Final Answers (Manual or confirmed)
    greeting = Column(String(10))
    hipaa_verification = Column(String(10))
    resolve_concern = Column(String(10))
    pci_compliance = Column(String(10))
    call_closing = Column(String(10))
    professionalism = Column(String(10))
    call_management = Column(String(10))
    documentation = Column(String(10))

    # Foreign Keys
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    lob_id = Column(Integer, ForeignKey("lobs.id"))
    user_id = Column(Integer, ForeignKey("users.id"))

    # Dynamic AI Results (supports any LOB criteria)
    ai_predictions_json = Column(JSONB, nullable=True)  # {"greeting": "Yes", "upsell_attempt": "No", ...}
    ai_reasoning_json = Column(JSONB, nullable=True)     # {"greeting": "Used warm tone", ...}
    initial_score = Column(Integer, nullable=True)        # AI-calculated score before manual review
    final_answers_json = Column(JSONB, nullable=True)     # {"greeting": "Yes", ...} Manual overrides
    human_observations = Column(Text, nullable=True)      # Global notes from QA analyst

    # PII Redaction fields
    pii_redacted = Column(Boolean, default=False)
    redacted_count = Column(Integer, default=0)
    redacted_types = Column(JSONB, nullable=True)  # {"phone": 2, "email": 1}
    redaction_log = Column(JSONB, nullable=True)  # Array of {type, start, end, hash}
    original_transcript_hash = Column(String(64), nullable=True)  # SHA-256 hash for audit

    # Evaluation metadata (model/provider traceability)
    eval_call_uid = Column(String(64), nullable=True, index=True)  # e.g. AUD-20260517-00142
    eval_model = Column(String(128), nullable=True)                 # e.g. llama3.2, gpt-4o-mini
    eval_provider = Column(String(64), nullable=True)               # e.g. ollama, openai
    eval_params_json = Column(JSONB, nullable=True)                 # temperature, ctx_size, etc.
    eval_started_at = Column(TIMESTAMP, nullable=True)              # when queued
    partial_transcript = Column(Text, nullable=True)                # saved after STT step

    # Relationships
    tenant = relationship("Tenant", back_populates="evaluations")
    lob = relationship("LOB", back_populates="evaluations")
    user = relationship("User", back_populates="evaluations")
