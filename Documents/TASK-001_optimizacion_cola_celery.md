# Task ID: TASK-001
**Título:** Optimización de Colas Celery para STT y LLM

**Contexto:** 
Actualmente, el sistema encola tareas pesadas de procesamiento de audio (Faster-Whisper) y llamadas de red/cómputo a LLMs. Si ambas tareas comparten la misma cola y configuración de workers, los procesos de inferencia de audio (altamente demandantes de CPU/GPU) bloquearán la ejecución de consultas a LLMs, generando cuellos de botella y demoras inaceptables en el procesamiento de múltiples llamadas concurrentes.

**Objetivo:** 
Separar lógicamente y físicamente los workers de STT (Speech-to-Text) y LLM, optimizando el concurrency y evitando la inanición de tareas de red.

**Detalles Técnicos:**
- **Backend (app/core/celery_app.py):** Configurar `task_routes` para dirigir tareas a colas específicas (`stt_queue`, `llm_queue`).
- **Infra (docker-compose.yml):** Desplegar dos servicios de workers distintos. El worker de `stt_queue` debe tener `concurrency` bajo (ej. 1 o 2) y reserva de recursos GPU/CPU. El worker de `llm_queue` (si usa Cloud) puede usar Eventlet/Gevent con alto concurrency para manejar operaciones I/O bound.
- **Backend (app/tasks/evaluation_tasks.py):** Asignar explícitamente el routing de las tareas mediante decoradores `@celery_app.task(queue='...')`.

**Criterios de Aceptación:**
- [ ] Celery enruta correctamente las tareas de Faster-Whisper a `stt_queue`.
- [ ] Celery enruta las tareas de evaluación de modelos a `llm_queue`.
- [ ] El `docker-compose.yml` inicia workers separados con configuraciones de concurrencia optimizadas.
- [ ] Las métricas demuestran que una cola masiva de análisis LLM no se bloquea por un trabajo largo de STT.

**Plan de Acción:**
1. Modificar `celery_app.py` añadiendo las rutas y colas predeterminadas.
2. Actualizar las firmas de las tareas en `evaluation_tasks.py`.
3. Ajustar `docker-compose.yml` dividiendo el servicio `worker` actual en `worker-stt` y `worker-llm`.
4. Realizar pruebas de carga locales enviando 10 audios simultáneos y verificando la distribución en Redis/Celery.