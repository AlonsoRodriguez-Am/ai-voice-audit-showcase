# PLAN DE IMPLEMENTACIÓN: Retry Pattern y Circuit Breaker para LLMs Externos

## 1. Resumen Ejecutivo
Implementar mecanismos de resiliencia (Retry con Exponential Backoff y Circuit Breaker) en las llamadas de red hacia proveedores de LLM (OpenAI, Gemini, Ollama). Esto previene que fallos transitorios (ej. Rate Limits, timeouts) bloqueen el pipeline, y que fallos sistémicos sobrecarguen una API que ya está caída.

## 2. Prerrequisitos
- Librería de resiliencia: `pip install tenacity`.
- Opcionalmente `pip install pybreaker` o usar Tenacity para un circuit breaker rudimentario.

## 3. Impacto en Archivos Existentes
- `app/services/llm_service.py`
- `app/tasks/evaluation_tasks.py`
- `app/core/error_responses.py` (Opcional, para logs/notificaciones)

## 4. Guía Paso a Paso

- **Paso 4.1: Capa de Servicio (app/services/llm_service.py)**
  - Implementar Retry logic usando la librería `tenacity`:
  ```python
  from tenacity import retry, wait_exponential, stop_after_attempt, retry_if_exception_type
  import httpx
  import logging

  logger = logging.getLogger(__name__)

  class RateLimitExceeded(Exception):
      pass

  # Retry si hay un error HTTP, con backoff exponencial: 2s, 4s, 8s... hasta 5 intentos
  @retry(
      wait=wait_exponential(multiplier=2, min=2, max=30),
      stop=stop_after_attempt(5),
      retry=retry_if_exception_type((httpx.RequestError, RateLimitExceeded)),
      before_sleep=lambda retry_state: logger.warning(f"Reintentando LLM... Intento {retry_state.attempt_number}")
  )
  async def call_llm_provider(prompt: str, config: dict):
      async with httpx.AsyncClient() as client:
          try:
              response = await client.post(...)
              if response.status_code == 429:
                  raise RateLimitExceeded("Rate limit reached")
              response.raise_for_status()
              return response.json()
          except httpx.HTTPStatusError as e:
              if e.response.status_code in [500, 502, 503, 504]:
                  raise httpx.RequestError(f"Server error {e.response.status_code}", request=e.request)
              raise e # No reintentar 400 Bad Request
  ```

- **Paso 4.2: Capa de Tareas Asíncronas (app/tasks/evaluation_tasks.py)**
  - Implementar un mecanismo de respaldo (Fallback) en caso de que el Circuit Breaker / todos los retries fallen, para marcar la evaluación como fallida de forma limpia sin dejarla "colgada":
  ```python
  @celery_app.task(bind=True, max_retries=1) # Usamos tenacity para los reintentos síncronos dentro de la tarea, Celery solo hace retry de contingencia mayor
  def analyze_transcript_task(self, evaluation_id: int, clean_transcript: str):
      try:
          import asyncio
          result = asyncio.run(call_llm_provider(clean_transcript, config))
          # Guardar éxito
          save_evaluation_result(evaluation_id, result)
      except Exception as e:
          # Guardar estado fallido permanente en DB para que el frontend sepa qué pasó
          mark_evaluation_as_failed(evaluation_id, reason=str(e))
          logger.error(f"Fallo crítico en evaluación {evaluation_id}: {e}")
  ```

- **Paso 4.3: Capa de Frontend (Opcional - Notificación de Error)**
  - Asegurar que la UI maneje el estado de error de forma gracefully. Si WebSocket o API retorna `status: FAILED`, mostrar un Toast de error.

## 5. Estrategia de Testing
- **Prueba de Recuperación (Mocking):** Usar `pytest` y `respx` para mockear un endpoint de LLM que retorne HTTP 429 (Too Many Requests) durante las primeras 3 llamadas, y HTTP 200 en la cuarta. Afirmar que el decorador `@retry` esperó y ejecutó el reintento exitosamente.
- **Fallo Absoluto:** Mockear 5 respuestas HTTP 500 seguidas, y confirmar que la función `analyze_transcript_task` captura la excepción final y llama a `mark_evaluation_as_failed` correctamente.

## 6. Riesgos y Mitigación
- **Riesgo:** El reintento prolongado puede causar "Celery Task Starvation", donde workers se quedan bloqueados durmiendo esperando reintentos (si se hace síncronamente).
- **Mitigación:** Dado que Celery es síncrono por defecto, si los tiempos de backoff se vuelven largos (ej. 30s+), es preferible usar los retries asíncronos nativos de Celery `self.retry(exc=e, countdown=10)` en lugar de `tenacity` que bloquea el worker thread. Ajustar `tenacity` solo para micro-retries inmediatos de red (ej. <= 5 segundos en total).