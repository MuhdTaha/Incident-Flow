import os
from typing import List
from groq import Groq
from botocore.exceptions import ClientError
from sqlalchemy.orm import Session
from app.db import models
from app.core.storage import get_s3_client, BUCKET_NAME, S3_EXTERNAL_ENDPOINT

class AIServiceError(Exception):
  """Raised when the AI provider cannot generate a post-mortem."""


class AIServiceConfigError(AIServiceError):
  """Raised when AI provider configuration is missing or invalid."""

class AIService:
  DEFAULT_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
  ]

  @staticmethod
  def _report_key(incident_id: str) -> str:
    return f"postmortems/{incident_id}/latest.md"

  @staticmethod
  def _report_url(file_key: str) -> str:
    return f"{S3_EXTERNAL_ENDPOINT}/{BUCKET_NAME}/{file_key}"

  @staticmethod
  def _ensure_bucket_exists() -> None:
    s3 = get_s3_client()
    try:
      s3.head_bucket(Bucket=BUCKET_NAME)
    except ClientError:
      s3.create_bucket(Bucket=BUCKET_NAME)

  @staticmethod
  def _get_client() -> Groq:
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
      raise AIServiceConfigError("GROQ_API_KEY is not configured")
    return Groq(api_key=api_key)

  @staticmethod
  def _candidate_models() -> List[str]:
    models: List[str] = []

    primary = os.environ.get("GROQ_MODEL")
    if primary:
      models.append(primary.strip())

    fallbacks = os.environ.get("GROQ_MODEL_FALLBACKS", "")
    if fallbacks:
      models.extend([m.strip() for m in fallbacks.split(",") if m.strip()])

    for default_model in AIService.DEFAULT_MODELS:
      if default_model not in models:
        models.append(default_model)

    return models

  @staticmethod
  def _is_model_decommissioned_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "model_decommissioned" in text or "decommissioned" in text

  @staticmethod
  def save_post_mortem(incident_id: str, markdown_report: str) -> dict:
    file_key = AIService._report_key(incident_id)

    try:
      AIService._ensure_bucket_exists()
      get_s3_client().put_object(
        Bucket=BUCKET_NAME,
        Key=file_key,
        Body=markdown_report.encode("utf-8"),
        ContentType="text/markdown; charset=utf-8",
      )
    except Exception as exc:
      raise AIServiceError(f"Failed to save post-mortem to storage: {exc}") from exc

    return {
      "file_key": file_key,
      "file_url": AIService._report_url(file_key),
    }

  @staticmethod
  def get_saved_post_mortem(incident_id: str) -> dict:
    file_key = AIService._report_key(incident_id)

    try:
      response = get_s3_client().get_object(Bucket=BUCKET_NAME, Key=file_key)
    except ClientError as exc:
      code = exc.response.get("Error", {}).get("Code", "")
      if code in {"NoSuchKey", "NoSuchBucket", "404"}:
        raise ValueError("Post-mortem report not found") from exc
      raise AIServiceError(f"Failed to fetch post-mortem from storage: {exc}") from exc

    body = response["Body"].read().decode("utf-8")
    return {
      "file_key": file_key,
      "file_url": AIService._report_url(file_key),
      "report_markdown": body,
    }

  @staticmethod
  def generate_post_mortem(db: Session, incident_id: str) -> str:
    # 1. Fetch the Incident and its Events (Audit Log)
    incident = db.query(models.Incident).filter(models.Incident.id == incident_id).first()
    if not incident:
      raise ValueError("Incident not found")

    events = db.query(models.IncidentEvent).filter(
      models.IncidentEvent.incident_id == incident_id
    ).order_by(models.IncidentEvent.created_at.asc()).all()

    # 2. Format the timeline for the LLM
    timeline_str = ""
    for event in events:
      time_str = event.created_at.strftime("%Y-%m-%d %H:%M:%S")
      actor = event.actor.full_name if event.actor else "System"
      action = f"Changed {event.event_type} from {event.old_value} to {event.new_value}" if event.old_value else event.event_type
      comment = f" - Comment: {event.comment}" if event.comment else ""
      timeline_str += f"[{time_str}] {actor}: {action}{comment}\n"

    # 3. Calculate downtime
    duration = "Unknown"
    if incident.resolved_at and incident.created_at:
      delta = incident.resolved_at - incident.created_at
      duration = f"{round(delta.total_seconds() / 60)} minutes"

    # 4. Construct the Prompt
    prompt = f"""
    You are an expert Site Reliability Engineer (SRE). Write a professional, blameless Post-Mortem report for the following incident.
    Output ONLY valid Markdown. Do not include introductory conversational text.

    Incident Details:
    - Title: {incident.title}
    - Severity: {incident.severity}
    - Description: {incident.description}
    - Total Downtime: {duration}

    Audit Log Timeline:
    {timeline_str}

    Use this exact Markdown structure:
    # Incident Post-Mortem: {incident.title}
    ## 1. Executive Summary
    (A brief 2-3 sentence summary of what happened and the impact)
    ## 2. Root Cause
    (Analyze the timeline and infer the likely root cause based on the engineer's comments)
    ## 3. Timeline of Events
    (Summarize the raw audit logs into a clean, human-readable bulleted timeline)
    ## 4. Action Items
    (Suggest 2-3 technical improvements or safeguards to prevent this from happening again)
    """

    # 5. Call the Groq API with fallback models if a model is deprecated/decommissioned.
    client = AIService._get_client()
    completion = None
    last_error: Exception | None = None

    for model_name in AIService._candidate_models():
      try:
        completion = client.chat.completions.create(
          model=model_name,
          messages=[
            {"role": "system", "content": "You are a senior SRE. Output only Markdown."},
            {"role": "user", "content": prompt}
          ],
          temperature=0.3, # Low temperature for factual, analytical tone
          max_tokens=1024,
        )
        break
      except Exception as exc:
        last_error = exc
        if AIService._is_model_decommissioned_error(exc):
          continue
        raise AIServiceError(f"Groq request failed: {exc}") from exc

    if completion is None:
      if last_error is None:
        raise AIServiceError("Groq request failed: no model candidates configured")
      raise AIServiceError(f"Groq request failed after trying fallback models: {last_error}") from last_error

    report = completion.choices[0].message.content if completion.choices else None
    if not report:
      raise AIServiceError("Groq returned an empty response")
    return report