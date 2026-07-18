# Task ID: TASK-002
**Título:** Implementación de WebSockets para Progreso en Tiempo Real

**Contexto:** 
El pipeline actual (Upload -> STT -> Análisis LLM -> Persistencia) puede tomar varios minutos por llamada. Una experiencia basada en polling HTTP estándar sobrecarga el servidor y proporciona una experiencia de usuario (UX) deficiente. El usuario necesita retroalimentación visual inmediata sobre en qué fase se encuentra su auditoría.

**Objetivo:** 
Implementar notificaciones push bidireccionales mediante WebSockets para que el frontend React actualice el estado de las evaluaciones en tiempo real.

**Detalles Técnicos:**
- **Backend (FastAPI):** Crear un router `/ws/evaluations/{tenant_id}/{client_id}`. Mantener un `ConnectionManager` en memoria o usando Redis Pub/Sub (ideal para multi-instancia).
- **Workers (Celery):** Modificar `evaluation_tasks.py` para publicar actualizaciones de estado (ej. `["STT_STARTED", "STT_COMPLETED", "LLM_ANALYZING", "DONE"]`) a través de Redis Pub/Sub cuando cambien de fase.
- **Frontend (React):** Crear un hook custom `useEvaluationWebSocket(evaluationId)` que escuche eventos e integre con TanStack Query (invalidando queries o actualizando la caché local optimísticamente) para mover barras de progreso o insignias de estado.

**Criterios de Aceptación:**
- [ ] FastAPI acepta y mantiene conexiones WebSocket seguras validando JWT del Tenant.
- [ ] Los workers de Celery emiten eventos de transición de estado a Redis.
- [ ] El Frontend actualiza visualmente el estado de una evaluación sin necesidad de recargar la página o hacer polling.

**Plan de Acción:**
1. Crear `app/api/routers/ws.py` con el gestor de conexiones.
2. Integrar publicador Redis en las tareas de Celery.
3. Implementar el hook en `src/api/client.ts` o como contexto separado en React.
4. Actualizar `DashboardPage.tsx` o `EvaluationPage.tsx` para reflejar estados parciales.