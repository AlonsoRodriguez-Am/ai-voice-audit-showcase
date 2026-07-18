import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.api import deps
from app.models.user import User
from app.models.lob import LOB

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def admin_user():
    return User(id=1, email="admin@test.com", role="admin")

@pytest.fixture(autouse=True)
def setup_overrides(admin_user, mock_db):
    app.dependency_overrides[deps.get_current_user] = lambda: admin_user
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    yield
    app.dependency_overrides.clear()

def test_get_lobs(client, mock_db):
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        LOB(id=1, name="Test LOB", is_active=True, system_prompt="test", criteria_json={}, is_builtin=False, created_at=datetime.now())
    ]
    response = client.get("/api/lobs/")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Test LOB"

def test_create_lob(client, mock_db):
    mock_db.add.return_value = None
    mock_db.commit.return_value = None
    mock_db.refresh.side_effect = lambda x: setattr(x, "id", 2)
    
    payload = {
        "name": "New LOB",
        "system_prompt": "You are a tester",
        "criteria_json": {"test": {"question": "ok?"}},
        "is_active": True
    }
    
    response = client.post("/api/lobs/", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert response.json()["id"] == 2

def test_delete_lob(client, mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = LOB(id=1, is_active=False)
    
    response = client.delete("/api/lobs/1")
    assert response.status_code == 200
    assert response.json()["success"] is True

def test_get_active_lobs(client, mock_db):
    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [
        LOB(id=1, name="Active LOB", is_active=True, system_prompt="test", criteria_json={}, is_builtin=False, created_at=datetime.now())
    ]
    response = client.get("/api/lobs/active")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["is_active"] is True

def test_activate_multiple_lobs(client, mock_db):
    # This test is more about the service, but we can test the endpoint
    # Mocking the service to verify it's called correctly
    from app.services import lob_service
    original_activate = lob_service.activate_lob
    lob_service.activate_lob = MagicMock(return_value=True)
    
    response = client.put("/api/lobs/1/activate")
    assert response.status_code == 200
    assert lob_service.activate_lob.called
    
    lob_service.activate_lob = original_activate
