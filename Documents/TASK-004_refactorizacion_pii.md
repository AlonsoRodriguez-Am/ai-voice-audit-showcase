# Task ID: TASK-004
**Título:** Refactorización de Seguridad para PII Redaction en Memoria

**Contexto:** 
Si el texto de la transcripción cruda se guarda en base de datos temporalmente o se envía a LLMs externos antes de pasar por `app/core/pii_redactor.py`, se corre el riesgo de filtrar datos sensibles, incumpliendo normativas como PCI-DSS o HIPAA.

**Objetivo:** 
Garantizar que la redacción de PII ocurra en memoria estrictamente antes de cualquier persistencia o llamada a API externa.

**Detalles Técnicos:**
- **Pipeline de Datos:** Asegurar que el output de Faster-Whisper se asigne a una variable temporal y se pase inmediatamente por el motor de redacción (basado en Regex/Presidio) antes de tocar el ORM SQLAlchemy.
- **Mapeo de Entidades:** Configurar una tabla de mapeo (ej. `[NAME_1]` -> "Juan") que persista de forma segura en `pii_audit_log` usando cifrado AES-256 (Fernet) para permitir "de-redaction" si es necesario para reportes de administradores autorizados.

**Criterios de Aceptación:**
- [ ] Ninguna transcripción en texto plano con PII es persistida en la DB de evaluaciones.
- [ ] Los logs del sistema y de Celery no muestran datos sensibles en texto plano.
- [ ] Las llaves de de-redaction (si aplican) se almacenan encriptadas con Fernet.

**Plan de Acción:**
1. Revisar `evaluation_tasks.py` para forzar la inyección de `pii_redactor` antes de la persistencia inicial y del envío al `llm_service.py`.
2. Escribir pruebas unitarias en `test_pii_redaction.py` pasando audios/textos sintéticos con tarjetas de crédito y comprobando la DB.