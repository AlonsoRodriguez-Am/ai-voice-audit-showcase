from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.user import UserLogin, UserResponse
from app.schemas.auth import TokenResponse, RefreshTokenRequest
from app.services import auth_service
from app.api import deps

from app.core.error_responses import ERROR_RESPONSES

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", 
             response_model=TokenResponse,
             summary="Authenticate User",
             responses={401: ERROR_RESPONSES[401]})
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user with email and password to obtain JWT tokens.
    
    ## Example curl:
    ```bash
    curl -X POST "http://localhost:5000/api/auth/login" \
         -H "Content-Type: application/json" \
         -d '{"email": "admin@acme.com", "password": "SecurePass456!"}'
    ```
    """
    user = auth_service.authenticate_user(db, login_data)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    access_token, refresh_token = auth_service.create_tokens(user)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user
    }

@router.post("/refresh", 
             summary="Refresh Access Token",
             responses={401: ERROR_RESPONSES[401]})
def refresh(refresh_data: RefreshTokenRequest, db: Session = Depends(get_db)):
    """
    Obtain a new access token using a valid refresh token.
    
    ## Example curl:
    ```bash
    curl -X POST "http://localhost:5000/api/auth/refresh" \
         -H "Content-Type: application/json" \
         -d '{"refresh_token": "eyJhbGci..."}'
    ```
    """
    access_token = auth_service.refresh_access_token(db, refresh_data.refresh_token)
    return {"access_token": access_token}

@router.post("/logout", 
             summary="Logout User",
             responses={401: ERROR_RESPONSES[401]})
def logout(request: Request, current_user = Depends(deps.get_current_user), db: Session = Depends(get_db)):
    """
    Invalidate the current access token by adding it to the blacklist.
    
    ## Example curl:
    ```bash
    curl -X POST "http://localhost:5000/api/auth/logout" \
         -H "Authorization: Bearer <access_token>"
    ```
    """
    # Extract token from header manually since we need it for blacklist
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1]
    auth_service.blacklist_token(db, token)
    return {"success": True, "message": "Logged out successfully"}
