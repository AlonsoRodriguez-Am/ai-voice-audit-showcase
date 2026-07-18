import os
from faster_whisper import WhisperModel

def initialize_whisper(model_size="tiny"):
    """Initialize Faster-Whisper model on CPU for maximum reliability in dev environments."""
    # Force 'tiny' for maximum speed and to avoid any hangs in constrained environments
    print(f"Loading Faster-Whisper model ({model_size}) on CPU...")
    try:
        # Use CPU with int8 for reliability. Tiny is so small it should be instant.
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print(f"Faster-Whisper ({model_size}) loaded successfully on CPU.")
        return model
    except Exception as e:
        print(f"Failed to load Faster-Whisper: {e}")
        raise e

def initialize_ollama_host():
    """Set Local LLM host for container networking."""
    os.environ["OPENAI_BASE_URL"] = "http://vllm:8899/v1"
    print(f"Local LLM base set to: {os.environ['OPENAI_BASE_URL']}")
