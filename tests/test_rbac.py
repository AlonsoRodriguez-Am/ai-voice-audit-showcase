import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
from unittest.mock import MagicMock
from app.main import app
from app.api import deps
from app.models.user import User
from app.models.evaluation import Evaluation

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def mock_user_container():
    """Container to allow swapping the mock user within tests."""
    return {"user": None}

@pytest.fixture(autouse=True)
def setup_overrides(mock_user_container, mock_db):
    """Automatically apply dependency overrides for all tests in this file."""
    
    def override_get_current_user():
        if mock_user_container["user"] is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return mock_user_container["user"]
    
    def override_get_db():
        yield mock_db

    app.dependency_overrides[deps.get_current_user] = override_get_current_user
    app.dependency_overrides[deps.get_db] = override_get_db
    
    yield
    
    app.dependency_overrides.clear()

# --- Tests ---

def test_admin_access_get_users(client, mock_user_container, mock_db):
    # Set mock user as admin
    mock_user_container["user"] = User(id=1, email="admin@test.com", role="admin")
    
    # Mock database query
    mock_db.query.return_value.all.return_value = [
        User(id=1, email="admin@test.com", role="admin")
    ]
    
    response = client.get("/api/users/")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["email"] == "admin@test.com"

def test_analyst_access_get_users_forbidden(client, mock_user_container):
    # Set mock user as analyst
    mock_user_container["user"] = User(id=10, email="analyst@test.com", role="analyst")
    
    response = client.get("/api/users/")
    # require_role(['admin']) should block analyst
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions"

def test_qa_manager_access_lobs(client, mock_user_container, mock_db):
    # Set mock user as qa_manager
    mock_user_container["user"] = User(id=5, email="qa@test.com", role="qa_manager")
    
    # Mock database query
    mock_db.query.return_value.all.return_value = []
    
    response = client.get("/api/lobs/")
    assert response.status_code == 200

def test_analyst_cannot_edit_others_evaluation(client, mock_user_container, mock_db):
    # Analyst (ID: 10)
    mock_user_container["user"] = User(id=10, email="analyst@test.com", role="analyst")
    
    # Mock evaluation record owned by ID: 99
    mock_eval = Evaluation(id=1, user_id=99)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_eval
    
    payload = {
        "evaluation_id": 1,
        "final_score": 90,
        "final_answers": {},
        "ttch": 60
    }
    
    response = client.post("/api/evaluation/save", json=payload)
    assert response.status_code == 403
    assert response.json()["detail"] == "Insufficient permissions to edit this evaluation"

def test_analyst_can_edit_own_evaluation(client, mock_user_container, mock_db):
    # Analyst (ID: 10)
    mock_user_container["user"] = User(id=10, email="analyst@test.com", role="analyst")
    
    # Mock evaluation record owned by ID: 10
    mock_eval = Evaluation(id=1, user_id=10)
    mock_db.query.return_value.filter.return_value.first.return_value = mock_eval
    
    payload = {
        "evaluation_id": 1,
        "final_score": 90,
        "final_answers": {},
        "ttch": 60
    }
    
    response = client.post("/api/evaluation/save", json=payload)
    # Should proceed past the ownership check
    assert response.status_code == 200
    assert response.json()["success"] is True

def test_unauthenticated_access(client, mock_user_container):
    # No user set
    mock_user_container["user"] = None
    
    response = client.get("/api/users/")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"
