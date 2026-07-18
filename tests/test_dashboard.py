"""Tests for the advanced dashboard endpoints (TASK-009)."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from datetime import datetime, timedelta


@pytest.fixture
def auth_headers(client):
    """Get auth headers for an admin user."""
    # Try to login; if the user doesn't exist, the test will be skipped
    response = client.post("/api/auth/login", json={
        "email": "admin@admin.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip("Admin user not available for testing")
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestDashboardMetrics:
    """Test the enhanced /api/dashboard/metrics endpoint."""

    def test_get_metrics_default(self, client, auth_headers):
        """Test default metrics without filters."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 10, "average_score": 85.0, "lob_distribution": []}
            response = client.get("/api/dashboard/metrics", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "total_evaluations" in data
            assert data["total_evaluations"] == 10

    def test_get_metrics_with_date_filter(self, client, auth_headers):
        """Test metrics with date range filter."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 5}
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            date_to = datetime.now().strftime("%Y-%m-%d")
            response = client.get(
                f"/api/dashboard/metrics?date_from={date_from}&date_to={date_to}",
                headers=auth_headers
            )
            assert response.status_code == 200
            assert response.json()["total_evaluations"] == 5

    def test_get_metrics_with_lob_filter(self, client, auth_headers):
        """Test metrics filtered by LOB ID."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 2}
            response = client.get("/api/dashboard/metrics?lob_id=1", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["total_evaluations"] == 2

    def test_get_metrics_with_range(self, client, auth_headers):
        """Test legacy range parameter."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 8}
            response = client.get("/api/dashboard/metrics?range=week", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["total_evaluations"] == 8


class TestTrendsEndpoint:
    """Test the /api/dashboard/trends endpoint."""

    def test_get_weekly_trends(self, client, auth_headers):
        """Test weekly trends."""
        with patch('app.api.routers.dashboard.dashboard_service.get_trends') as mock_trends:
            mock_trends.return_value = [{"period": "2024-W01", "avg_score": 90.0, "total_evals": 5}]
            response = client.get("/api/dashboard/trends?period=week", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["avg_score"] == 90.0

    def test_get_monthly_trends(self, client, auth_headers):
        """Test monthly trends."""
        with patch('app.api.routers.dashboard.dashboard_service.get_trends') as mock_trends:
            mock_trends.return_value = []
            response = client.get("/api/dashboard/trends?period=month", headers=auth_headers)
            assert response.status_code == 200
            assert response.json() == []

    def test_trends_with_filters(self, client, auth_headers):
        """Test trends with date and LOB filters."""
        with patch('app.api.routers.dashboard.dashboard_service.get_trends') as mock_trends:
            mock_trends.return_value = []
            date_from = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
            response = client.get(
                f"/api/dashboard/trends?period=week&date_from={date_from}&lob_id=1",
                headers=auth_headers
            )
            assert response.status_code == 200


class TestCTQDistribution:
    """Test the /api/dashboard/ctq-distribution endpoint."""

    def test_get_ctq_distribution(self, client, auth_headers):
        """Test CTQ distribution."""
        with patch('app.api.routers.dashboard.dashboard_service.get_ctq_distribution') as mock_ctq:
            mock_ctq.return_value = {"total_evaluated": 10, "distribution": []}
            response = client.get("/api/dashboard/ctq-distribution", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "total_evaluated" in data
            assert data["total_evaluated"] == 10

    def test_ctq_with_filters(self, client, auth_headers):
        """Test CTQ distribution with filters."""
        with patch('app.api.routers.dashboard.dashboard_service.get_ctq_distribution') as mock_ctq:
            mock_ctq.return_value = {"total_evaluated": 0, "distribution": []}
            response = client.get("/api/dashboard/ctq-distribution?lob_id=1", headers=auth_headers)
            assert response.status_code == 200


class TestTopicTrends:
    """Test the /api/dashboard/topic-trends endpoint."""

    def test_get_topic_trends(self, client, auth_headers):
        """Test topic trends."""
        with patch('app.api.routers.dashboard.dashboard_service.get_topic_trends') as mock_topics:
            mock_topics.return_value = {"topics": ["Topic A"], "data": []}
            response = client.get("/api/dashboard/topic-trends?period=week", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "topics" in data
            assert data["topics"] == ["Topic A"]

    def test_topic_trends_monthly(self, client, auth_headers):
        """Test monthly topic trends."""
"""Tests for the advanced dashboard endpoints (TASK-009)."""
import pytest
import io
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from datetime import datetime, timedelta


@pytest.fixture
def auth_headers(client):
    """Get auth headers for an admin user."""
    # Try to login; if the user doesn't exist, the test will be skipped
    response = client.post("/api/auth/login", json={
        "email": "admin@admin.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip("Admin user not available for testing")
    token = response.json().get("access_token")
    return {"Authorization": f"Bearer {token}"}


class TestDashboardMetrics:
    """Test the enhanced /api/dashboard/metrics endpoint."""

    def test_get_metrics_default(self, client, auth_headers):
        """Test default metrics without filters."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 10, "average_score": 85.0, "lob_distribution": []}
            response = client.get("/api/dashboard/metrics", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "total_evaluations" in data
            assert data["total_evaluations"] == 10

    def test_get_metrics_with_date_filter(self, client, auth_headers):
        """Test metrics with date range filter."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 5}
            date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
            date_to = datetime.now().strftime("%Y-%m-%d")
            response = client.get(
                f"/api/dashboard/metrics?date_from={date_from}&date_to={date_to}",
                headers=auth_headers
            )
            assert response.status_code == 200
            assert response.json()["total_evaluations"] == 5

    def test_get_metrics_with_lob_filter(self, client, auth_headers):
        """Test metrics filtered by LOB ID."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 2}
            response = client.get("/api/dashboard/metrics?lob_id=1", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["total_evaluations"] == 2

    def test_get_metrics_with_range(self, client, auth_headers):
        """Test legacy range parameter."""
        with patch('app.api.routers.dashboard.dashboard_service.get_dashboard_metrics') as mock_metrics:
            mock_metrics.return_value = {"total_evaluations": 8}
            response = client.get("/api/dashboard/metrics?range=week", headers=auth_headers)
            assert response.status_code == 200
            assert response.json()["total_evaluations"] == 8


class TestTrendsEndpoint:
    """Test the /api/dashboard/trends endpoint."""

    def test_get_weekly_trends(self, client, auth_headers):
        """Test weekly trends."""
        with patch('app.api.routers.dashboard.dashboard_service.get_trends') as mock_trends:
            mock_trends.return_value = [{"period": "2024-W01", "avg_score": 90.0, "total_evals": 5}]
            response = client.get("/api/dashboard/trends?period=week", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["avg_score"] == 90.0

    def test_get_monthly_trends(self, client, auth_headers):
        """Test monthly trends."""
        with patch('app.api.routers.dashboard.dashboard_service.get_trends') as mock_trends:
            mock_trends.return_value = []
            response = client.get("/api/dashboard/trends?period=month", headers=auth_headers)
            assert response.status_code == 200
            assert response.json() == []

    def test_trends_with_filters(self, client, auth_headers):
        """Test trends with date and LOB filters."""
        with patch('app.api.routers.dashboard.dashboard_service.get_trends') as mock_trends:
            mock_trends.return_value = []
            date_from = (datetime.now() - timedelta(days=90)).strftime("%Y-%m-%d")
            response = client.get(
                f"/api/dashboard/trends?period=week&date_from={date_from}&lob_id=1",
                headers=auth_headers
            )
            assert response.status_code == 200


class TestCTQDistribution:
    """Test the /api/dashboard/ctq-distribution endpoint."""

    def test_get_ctq_distribution(self, client, auth_headers):
        """Test CTQ distribution."""
        with patch('app.api.routers.dashboard.dashboard_service.get_ctq_distribution') as mock_ctq:
            mock_ctq.return_value = {"total_evaluated": 10, "distribution": []}
            response = client.get("/api/dashboard/ctq-distribution", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "total_evaluated" in data
            assert data["total_evaluated"] == 10

    def test_ctq_with_filters(self, client, auth_headers):
        """Test CTQ distribution with filters."""
        with patch('app.api.routers.dashboard.dashboard_service.get_ctq_distribution') as mock_ctq:
            mock_ctq.return_value = {"total_evaluated": 0, "distribution": []}
            response = client.get("/api/dashboard/ctq-distribution?lob_id=1", headers=auth_headers)
            assert response.status_code == 200


class TestTopicTrends:
    """Test the /api/dashboard/topic-trends endpoint."""

    def test_get_topic_trends(self, client, auth_headers):
        """Test topic trends."""
        with patch('app.api.routers.dashboard.dashboard_service.get_topic_trends') as mock_topics:
            mock_topics.return_value = {"topics": ["Topic A"], "data": []}
            response = client.get("/api/dashboard/topic-trends?period=week", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert "topics" in data
            assert data["topics"] == ["Topic A"]

    def test_topic_trends_monthly(self, client, auth_headers):
        """Test monthly topic trends."""
        with patch('app.api.routers.dashboard.dashboard_service.get_topic_trends') as mock_topics:
            mock_topics.return_value = {"topics": [], "data": []}
            response = client.get("/api/dashboard/topic-trends?period=month", headers=auth_headers)
            assert response.status_code == 200


class TestReportExport:
    """Test the report export endpoints with format parameter."""

    def test_full_report_csv(self, client, auth_headers):
        """Test full report CSV export."""
        with patch('app.api.routers.reports.report_service.generate_full_report') as mock_report:
            mock_report.return_value = io.StringIO("col1,col2\nval1,val2")
            response = client.get("/api/reports/full-report?format=csv", headers=auth_headers)
            assert response.status_code == 200
            assert "text/csv" in response.headers.get("content-type", "")

    def test_summary_report_csv(self, client, auth_headers):
        """Test summary report CSV export."""
        with patch('app.api.routers.reports.report_service.generate_summary_report') as mock_report:
            mock_report.return_value = io.StringIO("summary_col1\nsummary_val1")
            response = client.get("/api/reports/summary-report?format=csv", headers=auth_headers)
            assert response.status_code == 200

    def test_full_report_with_date_filter(self, client, auth_headers):
        """Test full report with date filter."""
        with patch('app.api.routers.reports.report_service.generate_full_report') as mock_report:
            mock_report.return_value = io.StringIO("")
            date_from = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
            response = client.get(
                f"/api/reports/full-report?date_from={date_from}",
                headers=auth_headers
            )
            assert response.status_code == 200

    def test_full_report_with_lob_filter(self, client, auth_headers):
        """Test full report with LOB filter."""
        with patch('app.api.routers.reports.report_service.generate_full_report') as mock_report:
            mock_report.return_value = io.StringIO("")
            response = client.get("/api/reports/full-report?lob_id=1", headers=auth_headers)
            assert response.status_code == 200

    def test_ai_performance_report_with_filters(self, client, auth_headers):
        """Test AI performance report with filters."""
        with patch('app.api.routers.reports.report_service.generate_ai_performance_report') as mock_report:
            mock_report.return_value = io.StringIO("")
            response = client.get("/api/reports/ai-performance?lob_id=1", headers=auth_headers)
            assert response.status_code == 200
