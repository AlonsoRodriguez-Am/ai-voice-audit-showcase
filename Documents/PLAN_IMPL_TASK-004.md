# PLAN DE IMPLEMENTACIÓN: Refactorización de Seguridad para PII Redaction en Memoria

## 1. Resumen Ejecutivo
Asegurar que cualquier transcripción generada por Faster-Whisper sea depurada de Información de Identificación Personal (PII) directamente en memoria RAM, antes de ser persistida en PostgreSQL o enviada a cualquier API de IA (externa o local), garantizando el cumplimiento de normativas de privacidad.

## 2. Prerrequisitos
- Librería de criptografía instalada: `pip install cryptography`.
- Motor de redacción (ej. librerías regex o Microsoft Presidio) configurado.
- Variable de entorno `PII_ENCRYPTION_KEY` (AES-256 base64 url-safe) generada y disponible.

## 3. Impacto en Archivos Existentes
- `app/core/pii_redactor.py` (Creación o actualización)
- `app/core/encryption.py` (Creación o actualización)
- `app/tasks/evaluation_tasks.py`
- `app/models/pii_audit_log.py` (Creación o actualización)

## 4. Guía Paso a Paso

- **Paso 4.1: Capa de Criptografía (app/core/encryption.py)**
  - Implementar un singleton para Fernet:
  ```python
  from cryptography.fernet import Fernet
  from app.core.config import settings

  cipher_suite = Fernet(settings.PII_ENCRYPTION_KEY.encode())

  def encrypt_data(data: str) -> str:
      return cipher_suite.encrypt(data.encode()).decode()

  def decrypt_data(token: str) -> str:
      return cipher_suite.decrypt(token.encode()).decode()
  ```

- **Paso 4.2: Capa de Redacción (app/core/pii_redactor.py)**
  - Crear la lógica de redacción que devuelva el texto limpio y el diccionario de mapeos:
  ```python
  import re

  def redact_text(raw_text: str):
      mapping = {}
      # Ejemplo simple de Regex para Tarjeta de Crédito
      cc_pattern = r'\b(?:\d[ -]*?){13,16}\b'
      
      def replacer(match):
          entity_id = f"[REDACTED_CC_{len(mapping)}]"
          mapping[entity_id] = match.group(0)
          return entity_id

      clean_text = re.sub(cc_pattern, replacer, raw_text)
      return clean_text, mapping
  ```

- **Paso 4.3: Capa de Base de Datos (app/models/pii_audit_log.py)**
  - Asegurar el modelo SQLAlchemy para persistir los mapeos encriptados de forma segura:
  ```python
  from sqlalchemy import Column, Integer, String, ForeignKey, JSON
  from app.core.database import Base

  class PIIAuditLog(Base):
      __tablename__ = "pii_audit_logs"
      id = Column(Integer, primary_key=True, index=True)
      evaluation_id = Column(Integer, ForeignKey("evaluations.id"))
      encrypted_mapping = Column(String, nullable=False) # Guardará el JSON encriptado de las entidades
  ```

- **Paso 4.4: Capa de Tareas Asíncronas (app/tasks/evaluation_tasks.py)**
  - Integrar la redacción en el pipeline ANTES de guardar:
  ```python
  from app.core.pii_redactor import redact_text
  from app.core.encryption import encrypt_data
  import json

  @celery_app.task(...)
  def transcribe_audio_task(evaluation_id: int):
      # ... Whisper genera raw_transcript ...
      raw_transcript = whisper_model.transcribe(audio_path)
      
      # 1. Redacción en Memoria
      clean_transcript, mapping = redact_text(raw_transcript)
      
      # 2. Encriptación del mapa
      encrypted_map = encrypt_data(json.dumps(mapping))
      
      # 3. Persistencia Segura
      save_to_db_clean(evaluation_id, clean_transcript)
      save_pii_audit_log(evaluation_id, encrypted_map)
      
      # 4. Pasar al LLM la versión limpia
      analyze_transcript_task.delay(evaluation_id, clean_transcript)
  ```

## 5. Estrategia de Testing
- **Pruebas Unitarias:** Crear tests en `tests/test_pii_redaction.py` inyectando strings con números de tarjetas y DNIs falsos. Afirmar (assert) que el string devuelto no contiene los datos originales y que la función de desencriptación restaura el valor original usando el mapping.
- **Auditoría de DB:** Revisar manualmente (o vía script) que la columna `transcript` en la tabla `evaluations` contiene las marcas `[REDACTED_...]` y no el texto plano.

## 6. Riesgos y Mitigación
- **Riesgo:** Falsos negativos (PII que no se detecta y se filtra).
- **Mitigación:** Usar motores robustos como Microsoft Presidio con modelos NER de spaCy, además de Regex duro para patrones financieros. Mantener la política de "Deny by Default" donde sea posible.