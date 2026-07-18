from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class EvaluationBase(BaseModel):
    call_id: str = Field(..., description="Unique identifier for the call recording", examples=["CALL-123456"])
    lob_id: int = Field(..., description="ID of the Line of Business used for evaluation", examples=[1])

class EvaluationCreate(EvaluationBase):
    pass

class EvaluationUpdate(BaseModel):
    evaluation_id: int = Field(..., description="ID of the evaluation to update")
    final_score: int = Field(..., description="The manual score assigned by the QA analyst (0-100)", examples=[85])
    ttch: int = Field(..., description="Total Time to Complete Handling (seconds)", examples=[300])
    final_answers: Dict[str, Any] = Field(..., description="The finalized answers and justifications for each evaluation criterion")
    human_observations: Optional[str] = Field(None, description="Global observations from the human reviewer")

class EvaluationResponse(EvaluationBase):
    id: int = Field(..., description="Unique evaluation ID", examples=[101])
    full_transcript: Optional[str] = Field(None, description="The full transcribed text of the call")
    detected_language: Optional[str] = Field(None, description="The language detected by the STT model", examples=["en"])
    topics: Optional[str] = Field(None, description="Comma-separated topics identified in the call", examples=["billing, payment inquiry"])
    ttca_seconds: Optional[int] = Field(None, description="Total Time to Complete Analysis (seconds)", examples=[15])
    ttch_seconds: Optional[int] = Field(None, description="Total Time to Complete Handling (seconds)", examples=[450])
    final_score: Optional[int] = Field(None, description="The finalized quality score", examples=[92])
    evaluation_date: datetime = Field(..., description="Timestamp of the evaluation")
    had_error: bool = Field(..., description="Whether the processing encountered an error")
    error_message: Optional[str] = Field(None, description="Error details if had_error is True")
    human_observations: Optional[str] = Field(None, description="Global observations from the human reviewer")
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 101,
                "call_id": "CALL-2024-001",
                "lob_id": 1,
                "full_transcript": "[00:00] Agent: Hello... [00:05] Customer: Hi...",
                "detected_language": "en",
                "topics": "greeting, problem resolution",
                "ttca_seconds": 12,
                "ttch_seconds": 320,
                "final_score": 100,
                "evaluation_date": "2024-05-02T10:00:00",
                "had_error": False,
                "error_message": None
            }
        }

class AudioProcessRequest(BaseModel):
    """Note: Audio processing usually takes multipart/form-data."""
    pass

class BulkAudioRequest(BaseModel):
    """Note: Bulk processing usually takes multiple files."""
    pass
