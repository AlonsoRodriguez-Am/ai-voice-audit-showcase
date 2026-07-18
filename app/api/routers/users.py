from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.schemas.user import UserResponse
from app.models.user import User
from app.api import deps

from app.core.error_responses import ERROR_RESPONSES

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/", 
            response_model=List[UserResponse],
            summary="List All Users",
            responses={
                401: ERROR_RESPONSES[401],
                403: ERROR_RESPONSES[403]
            })
def get_users(db: Session = Depends(get_db), current_user = Depends(deps.require_role(['admin']))):
    """
    Retrieve a list of all registered users.
    
    **Restriction:** Only users with the `admin` role can access this endpoint.
    
    ## Example curl:
    ```bash
    curl -H "Authorization: Bearer <access_token>" "http://localhost:5000/api/users/"
    ```
    """
    users = db.query(User).all()
    return users
