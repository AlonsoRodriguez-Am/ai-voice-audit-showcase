import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from app.main import app
from app.api import deps
from app.models.user import User
from app.models.tenant import Tenant
from app.models.lob import LOB

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_db():
    return MagicMock()

@pytest.fixture
def test_tenant():
    return Tenant(id=1, name="Test Tenant", slug="test-tenant")

@pytest.fixture
def admin_user(test_tenant):
    return User(id=1, email="admin@test.com", role="admin", tenant_id=test_tenant.id)

@pytest.fixture(autouse=True)
def setup_overrides(admin_user, test_tenant, mock_db):
    app.dependency_overrides[deps.get_current_user] = lambda: admin_user
    app.dependency_overrides[deps.get_current_tenant] = lambda: test_tenant
    app.dependency_overrides[deps.require_role] = lambda roles: lambda: admin_user
    app.dependency_overrides[deps.get_db] = lambda: mock_db
    yield
    app.dependency_overrides.clear()

class TestLOBCrud:
    """Test LOB CRUD operations for Multi-LOB."""
    
    def test_create_lob_with_criteria(self, client, mock_db):
        """Create LOB with valid JSON criteria."""
        mock_db.add.return_value = None
        mock_db.commit.return_value = None
        mock_db.refresh.side_effect = lambda x: setattr(x, "id", 2)
        
        response = client.post("/api/lobs/", 
            json={
                "name": "Test LOB",
                "system_prompt": "You are an auditor...",
                "criteria_json": {
                    "greeting": {"question": "Did they greet?", "points": 10}
                },
                "is_active": True
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data['success'] == True
        assert 'id' in data
    
    def test_edit_lob_criteria(self, client, mock_db):
        """Edit LOB criteria."""
        mock_db.query.return_value.filter.return_value.first.return_value = LOB(
            id=1, name="Old LOB", tenant_id=1, is_active=False, criteria_json={}
        )
        response = client.put("/api/lobs/1", json={
            "name": "Updated LOB",
            "system_prompt": "Updated prompt",
            "criteria_json": {"new_key": {"question": "New?", "points": 5}},
            "is_active": True
        })
        assert response.status_code == 200
        assert response.json()["success"] == True

class TestLOBSelector:
    """Test LOB selector filtering in dashboard."""
    
    def test_dashboard_filters_by_lob(self, client, mock_db):
        """Dashboard metrics filtered by selected LOB."""
        from unittest.mock import patch
        
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_get_metrics:
            mock_get_metrics.return_value = {"total_evaluations": 5, "average_score": 85.5}
            
            response = client.get("/api/dashboard/metrics?lob_id=1")
            
            assert response.status_code == 200
            assert "total_evaluations" in response.json()
            mock_get_metrics.assert_called_once()
            args, kwargs = mock_get_metrics.call_args
            assert kwargs.get('lob_id') == 1
