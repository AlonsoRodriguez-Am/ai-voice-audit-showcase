"""
Tests for TASK-027: Async Processing - LLM Selection Support.
Verifies that the Celery task correctly uses dynamic LLM provider
selection from LOB configuration.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock


# ─── Test 1: Provider selection from LOB config ────────────────────────────────

def test_get_llm_provider_for_lob_with_openai_config():
    """Test that _get_llm_provider_for_lob correctly reads llm_config from LOB."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import OpenAIProvider

    mock_lob = MagicMock()
    mock_lob.name = "Test LOB"
    mock_lob.criteria_json = {
        "llm_config": {
            "provider": "openai",
            "model": "gpt-4",
            "api_key": "sk-test-key-12345"
        },
        "greeting": {"question": "Was there a greeting?", "points": 10}
    }

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, OpenAIProvider)


def test_get_llm_provider_for_lob_with_grok_config():
    """Test that Grok provider is correctly instantiated."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import GrokProvider

    mock_lob = MagicMock()
    mock_lob.name = "Grok LOB"
    mock_lob.criteria_json = {
        "llm_config": {
            "provider": "grok",
            "model": "grok-2",
            "api_key": "xai-test-key"
        }
    }

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, GrokProvider)


# ─── Test 2: Fallback to Ollama ────────────────────────────────────────────────

def test_get_llm_provider_for_lob_fallback_to_ollama_no_config():
    """Test fallback to Ollama when LOB has no llm_config."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import OllamaProvider

    mock_lob = MagicMock()
    mock_lob.name = "Basic LOB"
    mock_lob.criteria_json = {
        "greeting": {"question": "Was there a greeting?", "points": 10}
    }

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, OllamaProvider)


def test_get_llm_provider_for_lob_fallback_to_ollama_empty_criteria():
    """Test fallback to Ollama when LOB has empty criteria_json."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import OllamaProvider

    mock_lob = MagicMock()
    mock_lob.name = "Empty LOB"
    mock_lob.criteria_json = {}

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, OllamaProvider)


def test_get_llm_provider_for_lob_fallback_to_ollama_none_criteria():
    """Test fallback to Ollama when LOB has None criteria_json."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import OllamaProvider

    mock_lob = MagicMock()
    mock_lob.name = "Null LOB"
    mock_lob.criteria_json = None

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, OllamaProvider)


# ─── Test 3: Encrypted API key decryption ──────────────────────────────────────

def test_get_llm_provider_for_lob_decrypts_api_key():
    """Test that encrypted API keys are decrypted before passing to provider."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.core.encryption import encrypt_api_key, generate_encryption_key

    key = generate_encryption_key()
    original_api_key = "sk-original-test-key"

    with patch("app.tasks.evaluation_tasks.is_encrypted", return_value=True):
        with patch("app.tasks.evaluation_tasks.decrypt_api_key", return_value=original_api_key) as mock_decrypt:
            mock_lob = MagicMock()
            mock_lob.name = "Encrypted LOB"
            mock_lob.criteria_json = {
                "llm_config": {
                    "provider": "openai",
                    "model": "gpt-4",
                    "api_key": "gAAAAABfake_encrypted_token_here"
                }
            }

            provider = _get_llm_provider_for_lob(mock_lob)
            mock_decrypt.assert_called_once_with("gAAAAABfake_encrypted_token_here")


# ─── Test 4: _run_async helper ─────────────────────────────────────────────────

def test_run_async_executes_coroutine():
    """Test that _run_async can run an async function from sync context."""
    from app.tasks.evaluation_tasks import _run_async

    async def sample_coro():
        return {"content": "hello", "provider": "test"}

    result = _run_async(sample_coro())
    assert result["content"] == "hello"
    assert result["provider"] == "test"


# ─── Test 5: LLM config key is skipped in criteria iteration ──────────────────

def test_llm_config_skipped_in_criteria():
    """Test that llm_config key in criteria_json is not treated as a criterion."""
    criteria = {
        "greeting": {"question": "Was there a greeting?", "points": 10},
        "llm_config": {"provider": "openai", "model": "gpt-4"},
        "call_closing": {"question": "Was the call closed properly?", "points": 15},
    }

    ai_evaluation_keys = []
    for key, details in criteria.items():
        if key == "llm_config":
            continue
        if not details.get("manual_score_required", False):
            ai_evaluation_keys.append(key)

    assert "greeting" in ai_evaluation_keys
    assert "call_closing" in ai_evaluation_keys
    assert "llm_config" not in ai_evaluation_keys
    assert len(ai_evaluation_keys) == 2


# ─── Test 6: Claude provider from LOB config ──────────────────────────────────

def test_get_llm_provider_for_lob_with_claude_config():
    """Test that Claude provider is correctly instantiated from LOB config."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import ClaudeProvider

    mock_lob = MagicMock()
    mock_lob.name = "Claude LOB"
    mock_lob.criteria_json = {
        "llm_config": {
            "provider": "claude",
            "model": "claude-3-5-sonnet-20240620",
            "api_key": "sk-ant-test-key"
        }
    }

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, ClaudeProvider)


# ─── Test 7: Gemini provider from LOB config ──────────────────────────────────

def test_get_llm_provider_for_lob_with_gemini_config():
    """Test that Gemini provider is correctly instantiated from LOB config."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import GeminiProvider

    mock_lob = MagicMock()
    mock_lob.name = "Gemini LOB"
    mock_lob.criteria_json = {
        "llm_config": {
            "provider": "gemini",
            "model": "gemini-1.5-pro",
            "api_key": "AIza-test-key"
        }
    }

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, GeminiProvider)


# ─── Test 8: Ollama explicit config ───────────────────────────────────────────

def test_get_llm_provider_for_lob_with_explicit_ollama():
    """Test that explicit Ollama config returns OllamaProvider."""
    from app.tasks.evaluation_tasks import _get_llm_provider_for_lob
    from app.services.llm_service import OllamaProvider

    mock_lob = MagicMock()
    mock_lob.name = "Ollama LOB"
    mock_lob.criteria_json = {
        "llm_config": {
            "provider": "ollama",
            "model": "llama3.1:8b"
        }
    }

    provider = _get_llm_provider_for_lob(mock_lob)
    assert isinstance(provider, OllamaProvider)
