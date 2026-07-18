from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


class UserBase(BaseModel):
    email: EmailStr = Field(..., description="The user's email address", examples=["user@company.com"])
    role: str = Field("admin", description="The role assigned to the user", examples=["admin", "qa_manager", "analyst"])
    tenant_id: Optional[int] = Field(None, description="The tenant ID the user belongs to", examples=[1])


class UserCreate(UserBase):
    password: str = Field(..., description="The user's password", min_length=8, examples=["StrongPassword123!"])


class UserResponse(UserBase):
    id: int = Field(..., description="The unique identifier for the user", examples=[1])
    created_at: Optional[datetime] = Field(None, description="The timestamp when the user was created")

    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": 1,
                "email": "admin@acme.com",
                "role": "admin",
                "tenant_id": 1,
                "created_at": "2024-01-01T12:00:00"
            }
        }


class UserLogin(BaseModel):
    email: EmailStr = Field(..., description="User's registered email", examples=["admin@acme.com"])
    password: str = Field(..., description="User's secret password", examples=["SecurePass456!"])
