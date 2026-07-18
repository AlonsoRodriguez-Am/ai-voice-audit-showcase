# PLAN DE IMPLEMENTACIÓN: Corrección de Tests y Funcionalidad de PII Redaction

## Contexto
El usuario ha reportado: "verifica porque el PII no funciona ni los tests la funcionalidad del cosigo ahora esta muy estable asi que se especifico en donde cuando crees el plan de implementacion detallado con cpontexto detalle tecnico y criterios de aceptacion incluyedo de ultimo el plan de implementacion"

## 1. Resumen Ejecutivo
El módulo de PII Redaction (Redacción de Información Personal Identificable) presenta dos fallos críticos. Primero, a nivel de funcionalidad, la transcripción se está enviando "cruda" (con datos sensibles) al LLM externo *antes* de ser redactada, lo cual rompe la privacidad. Segundo, a nivel de testing, los tests unitarios están fallando de forma global porque pytest intenta levantar una base de datos SQLite en memoria que no soporta el tipo de columna `JSONB` de PostgreSQL debido a un "monkey-patch" obsoleto en `conftest.py`.

Este plan detalla cómo arreglar la compilación de SQLAlchemy para SQLite en los tests y cómo refactorizar el flujo de trabajo en Celery para que la redacción ocurra **antes** de cualquier llamada externa.

## 2. Detalles Técnicos (Prerrequisitos)
- Entorno local configurado (`pytest` instalado).
- SQLAlchemy >= 2.0.

## 3. Impacto en Archivos Existentes
- **Backend (Tests):**
  - `tests/conftest.py`
- **Backend (Celery Tasks):**
  - `app/tasks/evaluation_tasks.py`

## 4. Plan de Implementación (Guía Paso a Paso)

- **Paso 4.1: Capa de Testing (tests/conftest.py)**
  - Reemplazar el hack manual de `visit_JSONB` que causa el `UnsupportedCompilationError`. En su lugar, utilizar el decorador oficial `@compiles` de SQLAlchemy para mapear `JSONB` a `JSON` nativo en SQLite.
  ```python
  # Eliminar estas líneas en tests/conftest.py:
  # def visit_JSONB(self, type_, **kw): ...
  # SQLiteTypeCompiler.visit_JSONB = visit_JSONB

  # Añadir esto:
  from sqlalchemy.ext.compiler import compiles
  from sqlalchemy.dialects.postgresql import JSONB

  @compiles(JSONB, "sqlite")
  def compile_jsonb_sqlite(type_, compiler, **kw):
      return "JSON"
  ```

- **Paso 4.2: Capa de Procesamiento Asíncrono (app/tasks/evaluation_tasks.py)**
  - Mover la instanciación de `PIIRedactor` y el proceso de redacción para que se ejecuten inmediatamente al inicio de `analyze_transcript_task`, antes de construir el prompt del LLM.
  - Aplicar la redacción a cada segmento individualmente para preservar las marcas de tiempo y preparar la transcripción limpia.
  
  ```python
  # Modificar app/tasks/evaluation_tasks.py (dentro de analyze_transcript_task):

  # 1. Obtener la configuración del Tenant y configurar PIIRedactor TEMPRANO
  tenant = db.query(Tenant).filter(Tenant.id == stt_result["tenant_id"]).first()
  redactor = PIIRedactor(tenant.pii_config if tenant else {})
  
  redaction_log = []
  redacted_full_transcript = ""

  # 2. Redactar los segmentos ANTES de enviarlos al LLM
  for seg in stt_result["segments_data"]:
      redacted_text, log = redactor.redact_text(seg["text"])
      seg["text"] = redacted_text  # Reemplazar con texto limpio
      redaction_log.extend(log)
      redacted_full_transcript += f"{seg['id']}. {seg['timestamp']}: {redacted_text}\n"

  # 3. Construir el prompt con la transcripción redactada
  user_prompt = f"Transcript:\n{redacted_full_transcript}\n\nCriteria:\n" + "\n".join(detailed_criteria)

  # ... (Llamada al llm_provider.chat se hace de forma segura) ...

  # 4. Cuando se asignan los speakers (después del LLM), se usa stt_result["segments_data"] 
  # que ya está redactado en el paso 2.
  labeled_transcript = ""
  for seg in stt_result["segments_data"]:
      speaker = speaker_map.get(str(seg['id']), speaker_map.get(seg['id'], "Speaker"))
      labeled_transcript += f"{seg['timestamp']}: {speaker}: {seg['text']}\n"

  # 5. Guardar el Evaluation con los datos seguros
  eval_record = Evaluation(
      # ...
      full_transcript=labeled_transcript,  # <-- Ya está redactado
      pii_redacted=len(redaction_log) > 0,
      redacted_count=len(redaction_log),
      original_transcript_hash=hashlib.sha256(stt_result["full_transcript"].encode()).hexdigest(),
      redacted_types=redactor.get_redaction_stats(redaction_log),
      redaction_log=redaction_log if (tenant.pii_config.get("log_redactions") if tenant else True) else None
  )
  ```

## 5. Criterios de Aceptación
- [ ] Ejecutar `pytest tests/test_pii_redaction.py -v` y confirmar que los 11 tests pasan correctamente en verde, sin errores de compilación de SQLAlchemy.
- [ ] Procesar una llamada de prueba real que contenga números de teléfono o correos electrónicos.
- [ ] Verificar en la consola (o logs) que el prompt enviado al LLM externo ya contiene los tokens `***REDACTED***` en lugar de la información sensible.
- [ ] La base de datos guarda `full_transcript` con los datos censurados, y el registro de auditoría (`redaction_log`) se guarda correctamente.

## 6. Riesgos y Mitigación
- **Riesgo:** Al redactar por segmentos, los "offsets" (inicio/fin de caracteres) del `redaction_log` serán relativos al segmento específico, no a toda la llamada.
- **Mitigación:** Como el frontend no resalta PII según el index de caracteres de toda la llamada, sino que usa el texto final, esto es aceptable. El log retiene el hash del dato y el tipo exacto de PII detectado para auditoría.