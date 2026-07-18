from cryptography.fernet import Fernet
import base64
from typing import Optional

def get_encryption_key() -> bytes:
    """Get or generate Fernet key from env."""
    from app.core.config import settings
    if not settings.ENCRYPTION_KEY:
        raise ValueError("ENCRYPTION_KEY not set in .env")
    return base64.b64decode(settings.ENCRYPTION_KEY)

def encrypt_api_key(api_key: str) -> str:
    """Encrypt API key for storage."""
    if not api_key:
        return ""
    key = get_encryption_key()
    f = Fernet(key)
    encrypted = f.encrypt(api_key.encode())
    return base64.b64encode(encrypted).decode()

def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt API key for usage (in memory only)."""
    if not encrypted_key:
        return ""
    
    # If it doesn't look like an encrypted token, assume it's plaintext
    if not is_encrypted(encrypted_key):
        return encrypted_key

    try:
        key = get_encryption_key()
        f = Fernet(key)
        try:
            decoded = base64.b64decode(encrypted_key)
        except:
            decoded = encrypted_key.encode()
            
        decrypted = f.decrypt(decoded)
        return decrypted.decode()
    except Exception:
        # If decryption fails despite looking like an encrypted token,
        # it might be a different encoding or actual corrupted data.
        # Returning as-is for fallback.
        return encrypted_key

def is_encrypted(token: str) -> bool:
    """Check if string is likely an encrypted Fernet token."""
    if not token or len(token) < 50: # Fernet tokens are usually long
        return False
    try:
        # Fernet tokens are base64 encoded
        base64.b64decode(token)
        return True
    except Exception:
        return False

def generate_encryption_key() -> str:
    """Generate new Fernet key (run once, save to .env)."""
    return base64.b64encode(Fernet.generate_key()).decode()
