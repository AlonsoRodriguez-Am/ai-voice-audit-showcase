# PLAN DE IMPLEMENTACIÓN: Optimización de Colas Celery para STT y LLM

## 1. Resumen Ejecutivo
Separar físicamente la infraestructura de procesamiento de tareas aislando la inferencia de audio (Faster-Whisper, pesada en CPU/GPU) de la inferencia de LLM (I/O bound o GPU/API bound) mediante colas dedicadas en Celery. Esto evitará que llamadas de red rápidas a proveedores LLM queden bloqueadas detrás de transcripciones de audio de larga duración, mejorando el throughput global del sistema.

## 2. Prerrequisitos
- Redis configurado y funcionando como broker de Celery.
- Docker y Docker Compose instalados.

## 3. Impacto en Archivos Existentes
- `docker-compose.yml`
- `app/core/config.py`
- `app/core/celery_app.py`
- `app/tasks/evaluation_tasks.py`

## 4. Guía Paso a Paso

- **Paso 4.1: Capa de Configuración (Backend)**
  - En `app/core/config.py`, asegurar que existan variables de entorno para los nombres de las colas, por ejemplo `CELERY_STT_QUEUE_NAME="stt_queue"` y `CELERY_LLM_QUEUE_NAME="llm_queue"`.

- **Paso 4.2: Capa de Celery App (app/core/celery_app.py)**
  - Configurar el enrutamiento de tareas:
  ```python
  from celery import Celery
  from app.core.config import settings

  celery_app = Celery("worker", broker=settings.CELERY_BROKER_URL)

  celery_app.conf.task_routes = {
      "app.tasks.evaluation_tasks.transcribe_audio_task": {"queue": "stt_queue"},
      "app.tasks.evaluation_tasks.analyze_transcript_task": {"queue": "llm_queue"}
  }
  ```

- **Paso 4.3: Capa de Tareas (app/tasks/evaluation_tasks.py)**
  - Ajustar los decoradores de las tareas para que coincidan con las rutas (opcional si ya está en `task_routes`, pero buena práctica):
  ```python
  @celery_app.task(bind=True, name="app.tasks.evaluation_tasks.transcribe_audio_task", queue="stt_queue")
  def transcribe_audio_task(self, evaluation_id: int):
      # Lógica de Faster-Whisper
      pass

  @celery_app.task(bind=True, name="app.tasks.evaluation_tasks.analyze_transcript_task", queue="llm_queue")
  def analyze_transcript_task(self, evaluation_id: int):
      # Lógica de LLM
      pass
  ```

- **Paso 4.4: Capa de Infraestructura (docker-compose.yml)**
  - Reemplazar el servicio `worker` genérico por dos específicos:
  ```yaml
  worker-stt:
    build: .
    command: celery -A app.core.celery_app worker -Q stt_queue --concurrency=1 --loglevel=info
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    volumes:
      - ./app:/app

  worker-llm:
    build: .
    command: celery -A app.core.celery_app worker -Q llm_queue --concurrency=10 --loglevel=info -P gevent
    volumes:
      - ./app:/app
  ```

## 5. Estrategia de Testing
- **Prueba de Carga Local:** Enviar 5 archivos de audio grandes simultáneamente.
- **Monitoreo:** Usar Flower (`celery flower`) para observar que las tareas de transcripción se encolan en `stt_queue` y las tareas LLM (simuladas o reales) se distribuyen a los 10 hilos del `worker-llm` sin esperar a que terminen todos los audios.

## 6. Riesgos y Mitigación
- **Riesgo:** Inanición de memoria (OOM) en el worker STT si el concurrency es mayor a 1 sin suficiente VRAM.
- **Mitigación:** Limitar estrictamente el concurrency a 1 (o 2 si hay VRAM suficiente) en el comando de inicio de Celery para la cola `stt_queue`.