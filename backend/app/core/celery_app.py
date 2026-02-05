import os
from celery import Celery
from celery.schedules import crontab

# Get Redis URL from environment or localhost (for local testing)
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery = Celery(
  "incidentflow",
  broker=BROKER_URL,
  backend=BROKER_URL,
  include=["tasks"]
)

# Optional configuration
celery.conf.update(
  task_serializer="json",
  accept_content=["json"],
  result_serializer="json",
  timezone="UTC",
  enable_utc=True,
)

# Beat Schedule
celery.conf.beat_schedule = {
  "check-slas-every-minute": {
    "task": "tasks.check_sla_breaches", # The function name
    "schedule": crontab(minute=0), # Run every 60 minutes
  }
}