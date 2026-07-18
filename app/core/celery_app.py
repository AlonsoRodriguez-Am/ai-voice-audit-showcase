from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_heartbeat=0,  # Disable broker heartbeat checks to prevent disconnects during heavy long audio STT tasks
    broker_transport_options={"visibility_timeout": 43200},  # 12-hour visibility timeout for long audio queues
    task_routes={
        "app.tasks.evaluation_tasks.transcribe_audio_task": {"queue": settings.CELERY_STT_QUEUE_NAME},
        "app.tasks.evaluation_tasks.analyze_transcript_task": {"queue": settings.CELERY_LLM_QUEUE_NAME},
    }
)

# Auto-discover tasks
celery_app.autodiscover_tasks(["app.tasks"], related_name="evaluation_tasks")
