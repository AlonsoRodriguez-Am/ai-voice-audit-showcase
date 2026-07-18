import pytest
from app.services.llm_service import get_llm_provider, OllamaProvider, OpenAIProvider, GeminiProvider, ClaudeProvider, GrokProvider

def test_get_llm_provider_ollama():
    config = {"provider": "ollama", "model": "llama3.1:8b"}
    provider = get_llm_provider(config)
    assert isinstance(provider, OllamaProvider)

def test_get_llm_provider_openai():
    config = {"provider": "openai", "model": "gpt-4", "api_key": "sk-test..."}
    provider = get_llm_provider(config)
    assert isinstance(provider, OpenAIProvider)

def test_get_llm_provider_gemini():
    config = {"provider": "gemini", "model": "gemini-1.5-pro", "api_key": "ai-test..."}
    provider = get_llm_provider(config)
    assert isinstance(provider, GeminiProvider)

def test_get_llm_provider_claude():
    config = {"provider": "claude", "model": "claude-3-5-sonnet-20240620", "api_key": "sk-ant-..."}
    provider = get_llm_provider(config)
    assert isinstance(provider, ClaudeProvider)

def test_get_llm_provider_grok():
    config = {"provider": "grok", "model": "grok-2", "api_key": "x-test..."}
    provider = get_llm_provider(config)
    assert isinstance(provider, GrokProvider)

def test_get_llm_provider_no_config():
    """Should fallback to Ollama if no config."""
    provider = get_llm_provider(None)
    assert isinstance(provider, OllamaProvider)

def test_get_llm_provider_invalid():
    """Should fallback to Ollama if invalid provider."""
    config = {"provider": "invalid_provider"}
    provider = get_llm_provider(config)
    assert isinstance(provider, OllamaProvider)

@pytest.mark.asyncio
async def test_ollama_provider_test_connection(mocker):
    provider = OllamaProvider({"model": "test-model"})
    mock_create = mocker.AsyncMock()
    mock_create.return_value.choices = [mocker.Mock(message=mocker.Mock(content="CONNECTION_SUCCESS"))]
    mocker.patch.object(provider.client.chat.completions, 'create', new=mock_create)
    res = await provider.test_connection()
    assert res["status"] == "success"

@pytest.mark.asyncio
async def test_openai_provider_test_connection(mocker):
    provider = OpenAIProvider({"api_key": "test"})
    # Need to mock the async openai client
    mock_create = mocker.AsyncMock()
    mock_create.return_value.choices = [mocker.Mock(message=mocker.Mock(content="CONNECTION_SUCCESS"))]
    
    mocker.patch.object(provider.client.chat.completions, 'create', new=mock_create)
    
    res = await provider.test_connection()
    assert res["status"] == "success"
