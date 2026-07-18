import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.core.config import settings
from app.models.user import User
from app.models.token_blacklist import TokenBlacklist
from app.schemas.user import UserLogin
from app.schemas.auth import TokenResponse

def authenticate_user(db: Session, login_data: UserLogin):
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user:
        return None
    
    if not bcrypt.checkpw(login_data.password.encode('utf-8'), user.password_hash.encode('utf-8')):
        return None
    
    return user

def create_tokens(user: User):
    access_payload = {
        'user_id': user.id,
        'email': user.email,
        'role': user.role,
        'tenant_id': user.tenant_id,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    refresh_payload = {
        'user_id': user.id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    
    access_token = jwt.encode(access_payload, settings.JWT_SECRET, algorithm='HS256')
    refresh_token = jwt.encode(refresh_payload, settings.JWT_REFRESH_SECRET, algorithm='HS256')
    
    return access_token, refresh_token

def refresh_access_token(db: Session, refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, settings.JWT_REFRESH_SECRET, algorithms=['HS256'])
        user = db.query(User).filter(User.id == payload['user_id']).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
            
        access_payload = {
            'user_id': user.id,
            'email': user.email,
            'role': user.role,
            'tenant_id': user.tenant_id,
            'exp': datetime.now(timezone.utc) + timedelta(minutes=15)
        }
        access_token = jwt.encode(access_payload, settings.JWT_SECRET, algorithm='HS256')
        return access_token
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

def blacklist_token(db: Session, token: str):
    new_blacklist = TokenBlacklist(token=token)
    db.add(new_blacklist)
    db.commit()
