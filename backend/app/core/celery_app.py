import os
from celery import Celery
from celery.schedules import crontab

# Get Redis URL from environment or localhost (for local testing)
BROKER_URL = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")

celery = Celery(
  "incidentflow",
  broker=BROKER_URL,
  backend=BROKER_URL,
  include=["app.core.tasks"]
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
  "check-slas-hourly": {
    "task": "app.core.tasks.check_sla_breaches",
    "schedule": crontab(minute=0),  # every hour
  },
  "refresh-demo-data": {
    "task": "app.core.tasks.refresh_demo_data",
    # Every 2 hours — keeps audit timelines fresh for portfolio demos
    "schedule": crontab(minute=15, hour="*/2"),
    "kwargs": {"actions": 4},
  },
}