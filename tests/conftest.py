# tests/conftest.py
import pytest
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB

# Add the project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.core.database import Base, get_db
from app.core.seed import seed_db
from app.main import app

# Correctly compile JSONB for SQLite during tests
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

# SQLite in-memory for tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_db(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    connection = engine.connect()
    # transaction = connection.begin() # SQLite doesn't support nested transactions well here
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    # transaction.rollback()
    connection.close()

@pytest.fixture
def client():
    from app.main import app
    from fastapi.testclient import TestClient
    return TestClient(app)

@pytest.fixture(autouse=True)
def override_get_db(db_session):
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()

@pytest.fixture(autouse=True)
def mock_external_services(mocker):
    # Mock AsyncOpenAI
    mock_openai_async = mocker.patch("openai.AsyncOpenAI")
    mock_async_client = mock_openai_async.return_value
    
    mock_create = mocker.AsyncMock()
    mock_create.return_value.choices = [
        mocker.Mock(message=mocker.Mock(content="CONNECTION_SUCCESS"))
    ]
    mock_create.return_value.usage = mocker.Mock(prompt_tokens=10, completion_tokens=20)
    mock_async_client.chat.completions.create = mock_create
    
    # Mock OpenAI (sync client used in diagnostics)
    mock_openai_sync = mocker.patch("openai.OpenAI")
    mock_sync_client = mock_openai_sync.return_value
    
    mock_list_data = mocker.Mock()
    mock_list_data.data = [
        mocker.Mock(id="hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4")
    ]
    mock_sync_client.models.list.return_value = mock_list_data
    
    # Mock Faster-Whisper
    mock_whisper = mocker.patch("faster_whisper.WhisperModel")
    mock_instance = mock_whisper.return_value
    mock_instance.transcribe.return_value = ([], mocker.Mock(language="en"))
    
    # Mock pynvml
    mocker.patch("pynvml.nvmlInit")
    mocker.patch("pynvml.nvmlDeviceGetCount", return_value=1)
    
    return True
