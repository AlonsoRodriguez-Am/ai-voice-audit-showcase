from pydantic import BaseModel, Field
from .user import UserResponse

class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT access token", examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."])
    refresh_token: str = Field(..., description="JWT refresh token used to obtain new access tokens", examples=["eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."])
    token_type: str = Field("bearer", description="The type of token returned", examples=["bearer"])
    user: UserResponse

    class Config:
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGci...",
                "refresh_token": "eyJhbGci...",
                "token_type": "bearer",
                "user": {
                    "id": 1,
                    "email": "admin@acme.com",
                    "role": "admin",
                    "created_at": "2024-01-01T12:00:00"
                }
            }
        }

class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., description="The refresh token obtained during login", examples=["eyJhbGci..."])

    class Config:
        json_schema_extra = {
            "example": {
                "refresh_token": "eyJhbGci..."
            }
        }
