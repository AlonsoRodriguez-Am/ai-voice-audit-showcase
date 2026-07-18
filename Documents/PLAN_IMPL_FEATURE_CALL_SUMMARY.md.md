# PLAN DE IMPLEMENTACIÓN: Feature "Call Summary" (Resumen de Llamada)

## 1. Resumen Ejecutivo
Añadir una nueva capacidad al sistema para generar y visualizar un resumen ejecutivo de la llamada auditada. Esta función será opcional y configurable por LOB (Line of Business). Durante la evaluación, si el LOB tiene activada esta opción, se instruirá al LLM para que devuelva un resumen conciso junto con las calificaciones de QA. En la interfaz, este resumen se mostrará en la vista de evaluación (EvaluationPage) justo debajo del puntaje global.

## 2. Prerrequisitos
- Acceso a la base de datos PostgreSQL para aplicar nuevas migraciones con Alembic.
- El contenedor del backend debe estar corriendo para probar la migración.

## 3. Impacto en Archivos Existentes
- **Base de Datos:**
  - `alembic/versions/` (Nueva migración)
  - `app/models/lob.py`
  - `app/models/evaluation.py`
- **Backend (FastAPI):**
  - `app/schemas/lob.py`
  - `app/schemas/evaluation.py`
  - `app/services/llm_service.py`
  - `app/tasks/evaluation_tasks.py`
- **Frontend (React/Vite):**
  - `frontend/src/components/LOBModal.tsx` o `frontend/src/pages/LOBSettingsPage.tsx`
  - `frontend/src/pages/EvaluationPage.tsx`
  - `frontend/src/types/index.ts`

## 4. Guía Paso a Paso

- **Paso 4.1: Capa de Base de Datos (SQLAlchemy y Alembic)**
  - Modificar los modelos para acomodar los nuevos campos.
  ```python
  # app/models/lob.py
  class LOB(Base):
      # ... campos existentes ...
      requires_call_summary = Column(Boolean, default=False, nullable=False)

  # app/models/evaluation.py
  class Evaluation(Base):
      # ... campos existentes ...
      call_summary = Column(Text, nullable=True) # Text para permitir resúmenes largos
  ```
  - Generar y aplicar la migración:
  ```bash
  alembic revision --autogenerate -m "add_call_summary_feature"
  alembic upgrade head
  ```

- **Paso 4.2: Capa de Backend (Schemas y Pydantic)**
  - Actualizar `app/schemas/lob.py`:
  ```python
  class LOBCreate(BaseModel):
      # ...
      requires_call_summary: bool = False

  class LOBResponse(LOBCreate):
      id: int
  ```
  - Actualizar `app/schemas/evaluation.py`:
  ```python
  class EvaluationResponse(BaseModel):
      # ...
      score: float
      call_summary: Optional[str] = None
  ```

- **Paso 4.3: Capa de Procesamiento LLM (Prompt Engineering y Celery)**
  - Modificar `app/services/llm_service.py` para inyectar dinámicamente la instrucción del resumen si el LOB lo requiere.
  ```python
  def build_evaluation_prompt(transcript: str, lob_config: dict, requires_summary: bool) -> str:
      prompt = "Evalúa la siguiente transcripción basándote en los criterios proporcionados.\n"
      
      # Modificar el JSON Schema esperado por el LLM
      json_structure = {
          "criteria_evaluations": [{"criterion_id": "...", "score": 100, "reasoning": "..."}]
      }
      
      if requires_summary:
          prompt += "Además, debes proporcionar un resumen ejecutivo de la llamada en máximo 3 párrafos.\n"
          json_structure["call_summary"] = "Aquí va el resumen de la llamada."
          
      prompt += f"\nDebes devolver EXCLUSIVAMENTE un JSON válido con esta estructura:\n{json.dumps(json_structure)}\n"
      # ...
      return prompt
  ```
  - En `app/tasks/evaluation_tasks.py`, guardar el resumen parseado:
  ```python
  # ... después de recibir llm_response ...
  evaluation_record.call_summary = llm_response.get("call_summary", None)
  db.commit()
  ```

- **Paso 4.4: Capa de Frontend (React / Vite)**
  - **Types:** Actualizar `src/types/index.ts` añadiendo `requires_call_summary: boolean` a `LOB` y `call_summary?: string` a `Evaluation`.
  - **LOB Config:** En `LOBModal.tsx` o `LOBSettingsPage.tsx`, añadir un switch/checkbox para la configuración:
  ```tsx
  {/* UI usando Tailwind / Glassmorphism */}
  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
    <div>
      <h4 className="text-white font-medium">Generate Call Summary</h4>
      <p className="text-gray-400 text-sm">Instruct the AI to write a brief summary of the conversation.</p>
    </div>
    <Switch 
      checked={formData.requires_call_summary} 
      onChange={(val) => setFormData({...formData, requires_call_summary: val})} 
    />
  </div>
  ```
  - **Evaluation View:** En `EvaluationPage.tsx`, inyectar la sección debajo del score global.
  ```tsx
  {/* Debajo del componente de Score Global */}
  {evaluation.call_summary && (
    <div className="mt-6 p-6 bg-slate-800/50 backdrop-blur-md rounded-xl border border-slate-700">
      <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
        <FileText className="w-5 h-5 text-blue-400" />
        Call Summary
      </h3>
      <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
        {evaluation.call_summary}
      </div>
    </div>
  )}
  ```

## 5. Estrategia de Testing
- **Backend/DB:** Escribir un test en `tests/test_fastapi.py` (o similar) creando un LOB con `requires_call_summary=True`. Verificar que la respuesta de la evaluación mockeada contiene el campo y se guarda correctamente en DB.
- **Prompt LLM:** Probar el nuevo prompt manualmente usando el Swagger UI (`/docs`) contra un audio de prueba para asegurar que el modelo no se "confunde" al pedirle tanto criterios detallados como un resumen en el mismo JSON.
- **Frontend:** Verificar que al apagar el switch en la creación del LOB, no se muestra la caja vacía de resumen en evaluaciones posteriores.

## 6. Riesgos y Mitigación
- **Riesgo (Token Budget):** Pedir un resumen aumentará la cantidad de tokens de salida (Output Tokens) del modelo, lo que incrementa el tiempo de latencia y el costo (si se usa OpenAI/Gemini) o el uso de GPU (Ollama).
- **Mitigación:** Hacer la característica estrictamente "Opt-in" (apagada por defecto). Añadir un tooltip en el frontend advirtiendo que activar esta función incrementará el tiempo de análisis. Asegurarse de que el límite de `max_tokens` (o `num_predict` en Ollama) sea suficientemente alto para acomodar el JSON con el resumen.