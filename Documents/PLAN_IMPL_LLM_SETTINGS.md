# PLAN DE IMPLEMENTACIÓN: Inclusión de LLM Advanced Settings en el Entorno Actual

## 1. Contexto y Objetivos
El objetivo de este plan es integrar la configuración avanzada para los modelos locales de Ollama (`OllamaAdvancedSettings`) a lo largo de toda la pila del sistema (Frontend, Backend, Celery y Base de Datos). Esto permitirá adaptar la inferencia de manera dinámica para llamadas cortas (<5 mins) y largas (10+ mins), optimizando el uso de los 16 GB de VRAM disponibles en la GPU.

## 2. Ajustes Recomendados (Referencia para UI y Testing)

Basado en la RTX 5060 Ti (16GB VRAM), la configuración ideal (y sus valores por defecto a mostrar en el Frontend) es:

| Parámetro | Llamadas Cortas (<5 min) | Llamadas Largas (10+ min) | Justificación para QA |
| :--- | :--- | :--- | :--- |
| **Model** | `llama3.1:8b` | `qwen2.5:14b` (o `llama3.1:8b`) | Qwen2.5:14b razona mejor en contextos muy largos. |
| **`num_ctx`** | `4096` | `16384` | Contexto necesario para acomodar toda la transcripción sin cortar. |
| **`num_predict`** | `1024` | `2048` | Espacio necesario para la generación del JSON de salida (y el resumen). |
| **`temperature`**| `0.0` | `0.1` | Minimiza la "creatividad" o alucinación. Obliga al LLM a seguir el JSON. |
| **`repeat_penalty`**| `1.1` | `1.15` | Evita bucles infinitos de repetición en transcripciones largas. |

## 3. Guía de Implementación Técnica (Paso a Paso)

### Paso 3.1: Capa Backend - Actualización del Esquema Pydantic
**Archivo:** `app/schemas/lob.py`
Se debe asegurar que el esquema valide y proporcione valores por defecto que asuman el caso más general (llamadas largas) para prevenir fallos por defecto, e incluir una bandera para "Autoscaling".

```python
from pydantic import BaseModel, Field
from typing import Optional

class OllamaAdvancedSettings(BaseModel):
    temperature: float = Field(default=0.0, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    top_k: int = Field(default=40, ge=0)
    repeat_penalty: float = Field(default=1.15, ge=1.0, le=2.0)
    auto_context: bool = Field(default=True, description="Si es True, ajusta num_ctx basado en el tamaño del texto")
    num_ctx: int = Field(default=16384, ge=2048, le=32768)
    num_predict: int = Field(default=2048, ge=512)
    seed: Optional[int] = Field(default=42)

# Asegurar que LLMConfig lo incluya
class LLMConfig(BaseModel):
    # ...
    advanced_settings: Optional[OllamaAdvancedSettings] = None
```

### Paso 3.2: Capa Backend - Lógica del Provider (Ollama)
**Archivo:** `app/services/llm_service.py`
Modificar la clase `OllamaProvider` para que inyecte dinámicamente estos parámetros en la llamada a la API de Ollama (`ollama.chat` o la petición HTTP cruda).

```python
class OllamaProvider(LLMProvider):
    # ...
    async def chat(self, messages: list[dict]) -> dict:
        adv_settings = self.config.get("advanced_settings", {})
        
        # Calcular el tamaño aproximado de los tokens (1 palabra ~= 1.3 tokens)
        total_text = " ".join([m.get("content", "") for m in messages])
        estimated_input_tokens = int(len(total_text.split()) * 1.3)

        # Lógica Auto-Context
        num_ctx = adv_settings.get("num_ctx", 16384)
        if adv_settings.get("auto_context", True):
            num_predict = adv_settings.get("num_predict", 2048)
            calc_ctx = estimated_input_tokens + num_predict + 500 # 500 tokens de buffer
            if calc_ctx <= 4096: num_ctx = 4096
            elif calc_ctx <= 8192: num_ctx = 8192
            else: num_ctx = 16384
            
        options = {
            "temperature": adv_settings.get("temperature", 0.0),
            "num_ctx": num_ctx,
            "num_predict": adv_settings.get("num_predict", 2048),
            "repeat_penalty": adv_settings.get("repeat_penalty", 1.15),
            "top_p": adv_settings.get("top_p", 0.9),
            "top_k": adv_settings.get("top_k", 40)
        }
        if adv_settings.get("seed") is not None:
            options["seed"] = adv_settings.get("seed")

        # Inyectar options en la llamada (depende de la firma de la librería ollama-python)
        response = ollama.chat(model=self.config["model_name"], messages=messages, options=options)
        # ...
```

### Paso 3.3: Capa Frontend - Interfaz de Configuración de LOBs
**Archivo:** `frontend/src/pages/LOBSettingsPage.tsx` (o donde se edite el LOB)
Se debe crear una sección desplegable (Accordion) "⚙️ Advanced AI Settings" dentro de la configuración del modelo de IA, para que los administradores no cambien estos valores por error, pero tengan acceso.

```tsx
// Dentro del formulario de edición del LOB:
<div className="mt-4 border border-gray-700 rounded p-4">
  <h3 className="text-lg font-medium text-white mb-2">Advanced Local Inference (16GB VRAM Profile)</h3>
  
  <div className="grid grid-cols-2 gap-4">
    {/* Auto Context Toggle */}
    <div>
       <label>Auto-Scale Context Window</label>
       <Switch checked={formData.advanced_settings.auto_context} /* ... */ />
       <p className="text-xs text-gray-400">Dynamically sets up to 16k context for long calls.</p>
    </div>
    
    {/* Temperature Slider */}
    <div>
       <label>Temperature ({formData.advanced_settings.temperature})</label>
       <input type="range" min="0" max="1" step="0.1" /* ... */ />
       <p className="text-xs text-gray-400">Keep at 0.0 - 0.1 for strictly logical QA.</p>
    </div>
    
    {/* Num Predict */}
    <div>
       <label>Max Output Tokens (num_predict)</label>
       <input type="number" value={formData.advanced_settings.num_predict} /* ... */ />
       <p className="text-xs text-gray-400">Use 2048 to prevent truncated JSONs on long summaries.</p>
    </div>
  </div>
</div>
```

### Paso 3.4: Capa Infraestructura - Restricción de Concurrencia
**Archivo:** `docker-compose.yml`
Dado que el modelo usará hasta 16384 tokens de contexto, requerirá una porción masiva de los 16GB de VRAM. Para evitar colapsos ("CUDA Out of Memory"):
```yaml
  worker:
    # ...
    # CRÍTICO: Concurrencia en 1 para que Celery analice las llamadas de 1 en 1 en la GPU.
    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=1
```

## 4. Criterios de Aceptación
1.  **Frontend:** El usuario puede guardar un LOB con `temperature: 0.1` y `num_ctx: 16384`, y los cambios persisten en PostgreSQL (dentro del JSONB de `criteria_json.llm_config.advanced_settings`).
2.  **Backend (Llamadas Cortas):** Al procesar un audio de 1 minuto con `auto_context=True`, los logs del backend muestran que se le envió a Ollama un `num_ctx=4096`.
3.  **Backend (Llamadas Largas):** Al procesar un audio de 15 minutos, los logs muestran que se utilizó `num_ctx=16384` y el JSON devuelto está completo (no cortado).
4.  **Estabilidad (VRAM):** Durante la evaluación simultánea de 3 archivos en lote, el worker los procesa secuencialmente sin crashear el contenedor de Ollama.