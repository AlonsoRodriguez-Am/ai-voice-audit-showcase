# app/services/llm_service.py
import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any

import openai
import google.generativeai as genai
import anthropic
from app.core.encryption import decrypt_api_key
from app.core.config import settings

class LLMProvider(ABC):
    @abstractmethod
    async def chat(self, messages: List[Dict], model: str = None) -> Dict:
        """Send chat request to LLM and return response."""
        pass
    
    @abstractmethod
    async def test_connection(self) -> Dict:
        """Test connection and return {status: "success"/"error", message: "..."}"""
        pass

class OllamaProvider(LLMProvider):
    def __init__(self, config: Dict):
        # Fallback to settings.LOCAL_LLM_MODEL if not in config or using outdated defaults
        self.model = config.get("model")
        if not self.model or self.model == "llama3.1:8b":
            self.model = settings.LOCAL_LLM_MODEL
            
        self.host = config.get("api_base") or settings.LOCAL_LLM_API_BASE or "http://localhost:8899/v1"
        
        # If host points to localhost or 127.0.0.1 on port 8899 but we are running inside Docker,
        # dynamically route to the 'vllm' service host instead.
        if "localhost:8899" in self.host or "127.0.0.1:8899" in self.host:
            import socket
            try:
                socket.gethostbyname("vllm")
                self.host = self.host.replace("localhost:8899", "vllm:8899").replace("127.0.0.1:8899", "vllm:8899")
            except socket.gaierror:
                pass

        self.advanced_settings = config.get("advanced_settings") or {}
        
        # Initialize AsyncOpenAI client targeting the local vLLM server
        self.client = openai.AsyncOpenAI(api_key="none", base_url=self.host)

    async def _resolve_active_model(self, requested_model: str) -> str:
        """Query vLLM active models and transparently route to the loaded model to prevent 404 errors."""
        try:
            models_res = await self.client.models.list()
            if models_res.data:
                active_model = models_res.data[0].id
                return active_model
        except Exception as e:
            print(f"Warning: Failed to fetch active vLLM model dynamically: {e}")
        return requested_model
    
    async def chat(self, messages: List[Dict], model: str = None) -> Dict:
        import re
        requested_model = model or self.model
        model_to_use = await self._resolve_active_model(requested_model)
        adv = self.advanced_settings
        
        # Parameters with recommended defaults
        temperature = adv.get("temperature", 0.0)
        num_predict = adv.get("num_predict", 2048) # Maps to max_tokens in OpenAI
        
        # Build options dictionary for OpenAI-compatible vLLM
        params = {
            "model": model_to_use,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": num_predict,
            "top_p": adv.get("top_p", 0.9),
        }
        
        if adv.get("seed") is not None:
            params["seed"] = adv.get("seed")
            
        try:
            response = await self.client.chat.completions.create(**params)
            
            prompt_tokens = response.usage.prompt_tokens if hasattr(response, 'usage') and response.usage else 0
            completion_tokens = response.usage.completion_tokens if hasattr(response, 'usage') and response.usage else 0
            
            return {
                "content": response.choices[0].message.content,
                "model": model_to_use,
                "provider": "ollama", # Crucial for backward compatibility in backend flow
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens
                }
            }
        except openai.BadRequestError as e:
            err_msg = str(e)
            if "maximum context length" in err_msg or "context length" in err_msg:
                # Extract limits from the error message using regular expressions
                max_match = re.search(r"maximum context length is (\d+)", err_msg)
                prompt_match = re.search(r"contains at least (\d+) input tokens", err_msg)
                
                max_ctx = 8192  # Default fallback
                prompt_toks = None
                
                if max_match:
                    max_ctx = int(max_match.group(1))
                if prompt_match:
                    prompt_toks = int(prompt_match.group(1))
                
                if prompt_toks is None:
                    char_len = sum(len(m.get("content", "")) for m in messages)
                    prompt_toks = int(char_len / 3.8)
                
                # Self-Healing Step 1: Scale down output token reservation (max_tokens)
                # We start with a safe 150 token margin
                allowed_out = max_ctx - prompt_toks - 150
                if allowed_out >= 512:
                    print(f"[SELF-HEALING] Context limit exceeded: Prompt has {prompt_toks} tokens, requested output {num_predict} tokens.")
                    for retry_attempt in range(3):
                        print(f"[SELF-HEALING] Attempt {retry_attempt+1}: Retrying request with dynamically scaled-down max_tokens={allowed_out}...")
                        params["max_tokens"] = allowed_out
                        try:
                            response = await self.client.chat.completions.create(**params)
                            prompt_tokens = response.usage.prompt_tokens if hasattr(response, 'usage') and response.usage else 0
                            completion_tokens = response.usage.completion_tokens if hasattr(response, 'usage') and response.usage else 0
                            return {
                                "content": response.choices[0].message.content,
                                "model": model_to_use,
                                "provider": "ollama",
                                "usage": {
                                    "prompt_tokens": prompt_tokens,
                                    "completion_tokens": completion_tokens
                                }
                            }
                        except openai.BadRequestError as retry_err:
                            retry_err_str = str(retry_err)
                            if "maximum context length" in retry_err_str or "context length" in retry_err_str:
                                # If vLLM still claims it exceeds the limit due to tokenization fluctuations,
                                # parse the new, higher input token count and recalculate with a bigger buffer
                                new_prompt_match = re.search(r"contains at least (\d+) input tokens", retry_err_str)
                                if new_prompt_match:
                                    prompt_toks = int(new_prompt_match.group(1))
                                allowed_out = max_ctx - prompt_toks - 200  # Expand safety buffer even more
                                if allowed_out < 512:
                                    break
                            else:
                                raise retry_err
                        except Exception as retry_err:
                            print(f"[SELF-HEALING] Output-scaled retry failed: {retry_err}")
                            break
                
                # Self-Healing Step 2: If the prompt itself is too large, truncate the transcript midsection
                if allowed_out < 512 or "allowed_out" not in locals():
                    print("[SELF-HEALING] Prompt size exceeds safe limits. Truncating transcript mid-section...")
                    user_msg_idx = -1
                    for idx, msg in enumerate(messages):
                        if msg.get("role") == "user":
                            user_msg_idx = idx
                            break
                    
                    if user_msg_idx != -1:
                        user_content = messages[user_msg_idx]["content"]
                        parts = user_content.split("Criteria:")
                        if len(parts) == 2:
                            transcript_part = parts[0]
                            criteria_part = parts[1]
                            
                            # Parse segments and drop middle lines to fit
                            lines = transcript_part.strip().split("\n")
                            if len(lines) > 20:
                                keep_start = int(len(lines) * 0.4)
                                keep_end = int(len(lines) * 0.8)
                                truncated_transcript = (
                                    "\n".join(lines[:keep_start]) + 
                                    "\n... [Transcript truncated by self-healing algorithm due to context size limits] ...\n" + 
                                    "\n".join(lines[keep_end:])
                                )
                                new_user_content = f"{truncated_transcript}\n\nCriteria:{criteria_part}"
                                
                                messages[user_msg_idx]["content"] = new_user_content
                                params["messages"] = messages
                                params["max_tokens"] = min(1024, max_ctx - 2000)
                                
                                try:
                                    response = await self.client.chat.completions.create(**params)
                                    prompt_tokens = response.usage.prompt_tokens if hasattr(response, 'usage') and response.usage else 0
                                    completion_tokens = response.usage.completion_tokens if hasattr(response, 'usage') and response.usage else 0
                                    return {
                                        "content": response.choices[0].message.content,
                                        "model": model_to_use,
                                        "provider": "ollama",
                                        "usage": {
                                            "prompt_tokens": prompt_tokens,
                                            "completion_tokens": completion_tokens
                                        }
                                    }
                                except Exception as retry_err2:
                                    print(f"[SELF-HEALING] Truncated transcript retry failed: {retry_err2}")
            
            print(f"Error in vLLM local chat completions: {str(e)}")
            raise e
        except Exception as e:
            print(f"Error in vLLM local chat completions: {str(e)}")
            raise e
    
    async def test_connection(self) -> Dict:
        model_to_use = await self._resolve_active_model(self.model)
        try:
            response = await self.client.chat.completions.create(
                model=model_to_use,
                messages=[{"role": "user", "content": "Respond with: CONNECTION_SUCCESS"}],
                max_tokens=10,
                temperature=0.0
            )
            content = response.choices[0].message.content
            if "CONNECTION_SUCCESS" in content:
                return {"status": "success", "message": "Conexión exitosa con vLLM local"}
            return {"status": "error", "message": f"Respuesta inesperada de vLLM: {content}"}
        except Exception as e:
            return {"status": "error", "message": f"vLLM no disponible: {str(e)}"}

class OpenAIProvider(LLMProvider):
    def __init__(self, config: Dict):
        self.api_key = decrypt_api_key(config.get("api_key"))
        
        # Fallback to env var if no key in config
        if not self.api_key:
            self.api_key = settings.OPENAI_API_KEY
            
        self.model = config.get("model", "gpt-4o")
        self.api_base = config.get("api_base", "https://api.openai.com/v1")
        
        if not self.api_key:
            # We don't raise here yet to allow testing if needed, but chat will fail
            pass
            
        self.client = openai.AsyncOpenAI(api_key=self.api_key, base_url=self.api_base)
    
    async def chat(self, messages: List[Dict], model: str = None) -> Dict:
        if not self.api_key:
            raise ValueError("OpenAI API Key not configured")
        model_to_use = model or self.model
        response = await self.client.chat.completions.create(
            model=model_to_use,
            messages=messages
        )
        
        prompt_tokens = response.usage.prompt_tokens if hasattr(response, 'usage') and response.usage else 0
        completion_tokens = response.usage.completion_tokens if hasattr(response, 'usage') and response.usage else 0
# app/services/llm_service.py (continuación)
        return {
            "content": response.choices[0].message.content,
            "model": model_to_use,
            "provider": "openai",
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens
            }
        }
    
    async def test_connection(self) -> Dict:
        if not self.api_key:
            return {"status": "error", "message": "OpenAI API Key not configured"}
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Respond with: CONNECTION_SUCCESS"}]
            )
            if "CONNECTION_SUCCESS" in response.choices[0].message.content:
                return {"status": "success", "message": "Conexión exitosa con OpenAI API"}
            return {"status": "error", "message": "Respuesta inesperada de OpenAI"}
        except Exception as e:
            return {"status": "error", "message": f"OpenAI API error: {str(e)}"}

class GrokProvider(LLMProvider):
    def __init__(self, config: Dict):
        self.api_key = decrypt_api_key(config.get("api_key"))
        
        # Fallback to env var if no key in config
        if not self.api_key:
            self.api_key = settings.GROK_API_KEY
            
        self.model = config.get("model", "grok-3")
        self.api_base = config.get("api_base", "https://api.x.ai/v1")
        
        if not self.api_key:
            pass
            
        self.client = openai.AsyncOpenAI(api_key=self.api_key, base_url=self.api_base)
    
    async def chat(self, messages: List[Dict], model: str = None) -> Dict:
        if not self.api_key:
            raise ValueError("Grok API Key not configured")
        model_to_use = model or self.model
        response = await self.client.chat.completions.create(
            model=model_to_use,
            messages=messages
        )
        
        prompt_tokens = response.usage.prompt_tokens if hasattr(response, 'usage') and response.usage else 0
        completion_tokens = response.usage.completion_tokens if hasattr(response, 'usage') and response.usage else 0
        
        return {
            "content": response.choices[0].message.content,
            "model": model_to_use,
            "provider": "grok",
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens
            }
        }
    
    async def test_connection(self) -> Dict:
        if not self.api_key:
            return {"status": "error", "message": "Grok API Key not configured"}
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "Respond with: CONNECTION_SUCCESS"}]
            )
            if "CONNECTION_SUCCESS" in response.choices[0].message.content:
                return {"status": "success", "message": "Conexión exitosa con Grok API"}
            return {"status": "error", "message": "Respuesta inesperada de Grok"}
        except Exception as e:
            return {"status": "error", "message": f"Grok API error: {str(e)}"}

class GeminiProvider(LLMProvider):
    def __init__(self, config: Dict):
        self.api_key = decrypt_api_key(config.get("api_key"))
        
        # Fallback to env var if no key in config
        if not self.api_key:
            self.api_key = settings.GEMINI_API_KEY
            
        self.model = config.get("model", "gemini-3.1-flash-lite")
        
        if self.api_key:
            genai.configure(api_key=self.api_key)
            self.model_obj = genai.GenerativeModel(self.model)
        else:
            self.model_obj = None
    
    def _convert_messages_to_prompt(self, messages: List[Dict]) -> str:
        prompt = ""
        for msg in messages:
            role = msg.get("role", "user").capitalize()
            content = msg.get("content", "")
            prompt += f"{role}: {content}\n"
        return prompt.strip()

    async def chat(self, messages: List[Dict], model: str = None) -> Dict:
        if not self.api_key or not self.model_obj:
            raise ValueError("Gemini API Key not configured")
        prompt = self._convert_messages_to_prompt(messages)
        response = await self.model_obj.generate_content_async(prompt)
        
        prompt_tokens = response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') and response.usage_metadata else 0
        completion_tokens = response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') and response.usage_metadata else 0
        
        return {
            "content": response.text,
            "model": model or self.model,
            "provider": "gemini",
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens
            }
        }
    
    async def test_connection(self) -> Dict:
        if not self.api_key or not self.model_obj:
            return {"status": "error", "message": "Gemini API Key not configured"}
        try:
            response = await self.model_obj.generate_content_async("Respond with: CONNECTION_SUCCESS")
            if "CONNECTION_SUCCESS" in response.text:
                return {"status": "success", "message": "Conexión exitosa con Gemini API"}
            return {"status": "error", "message": "Respuesta inesperada de Gemini"}
        except Exception as e:
            return {"status": "error", "message": f"Gemini API error: {str(e)}"}

class ClaudeProvider(LLMProvider):
    def __init__(self, config: Dict):
        self.api_key = decrypt_api_key(config.get("api_key"))
        
        # Fallback to env var if no key in config
        if not self.api_key:
            self.api_key = settings.CLAUDE_API_KEY
            
        self.model = config.get("model", "claude-3-5-sonnet-20241022")
        
        if self.api_key:
            self.client = anthropic.AsyncAnthropic(api_key=self.api_key)
        else:
            self.client = None
    
    async def chat(self, messages: List[Dict], model: str = None) -> Dict:
        if not self.api_key or not self.client:
            raise ValueError("Claude API Key not configured")
        model_to_use = model or self.model
        
        system_prompt = ""
        anthropic_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_prompt += msg["content"] + "\n"
            else:
                anthropic_messages.append({"role": msg["role"], "content": msg["content"]})
        
        response = await self.client.messages.create(
            model=model_to_use,
            max_tokens=4096,
            system=system_prompt.strip(),
            messages=anthropic_messages
        )
        
        prompt_tokens = response.usage.input_tokens if hasattr(response, 'usage') and response.usage else 0
        completion_tokens = response.usage.output_tokens if hasattr(response, 'usage') and response.usage else 0
        
        return {
            "content": response.content[0].text,
            "model": model_to_use,
            "provider": "claude",
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens
            }
        }
    
    async def test_connection(self) -> Dict:
        if not self.api_key or not self.client:
            return {"status": "error", "message": "Claude API Key not configured"}
        try:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=100,
                messages=[{"role": "user", "content": "Respond with: CONNECTION_SUCCESS"}]
            )
            if "CONNECTION_SUCCESS" in response.content[0].text:
                return {"status": "success", "message": "Conexión exitosa con Claude API"}
            return {"status": "error", "message": "Respuesta inesperada de Claude"}
        except Exception as e:
            return {"status": "error", "message": f"Claude API error: {str(e)}"}

def get_llm_provider(config: Dict) -> LLMProvider:
    if not config:
        return OllamaProvider({"model": "llama3.1:8b"})
    
    provider = config.get("provider", "ollama").lower()
    
    if provider == "ollama":
        return OllamaProvider(config)
    elif provider == "openai":
        return OpenAIProvider(config)
    elif provider == "grok":
        return GrokProvider(config)
    elif provider == "gemini":
        return GeminiProvider(config)
    elif provider == "claude":
        return ClaudeProvider(config)
    else:
        print(f"Warning: Invalid provider '{provider}', falling back to Ollama")
        return OllamaProvider({"model": "llama3.1:8b"})
