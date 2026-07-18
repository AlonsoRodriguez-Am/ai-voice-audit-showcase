import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import Base, engine

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "AI Voice Audit API"

def test_auth_login_invalid():
    response = client.post(
        "/api/auth/login",
        json={"email": "wrong@admin.com", "password": "wrongpassword"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"

def test_docs_accessible():
    response = client.get("/docs")
    assert response.status_code == 200
