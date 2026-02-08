from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException

from app.schemas import analytics
from app.db import models
from app.api.deps import get_current_org_id, get_analytics_service, require_admin
from app.services.analytics_service import AnalyticsService

router = APIRouter()

@router.get("/stats", response_model=analytics.AdminDashboardStats)
def get_admin_stats(
  service: AnalyticsService = Depends(get_analytics_service),
  current_user: models.User = Depends(require_admin), 
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    return service.get_admin_dashboard_stats(current_org_id)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
def get_analytics(
  service: AnalyticsService = Depends(get_analytics_service),
  current_user: models.User = Depends(require_admin),
  current_org_id: UUID = Depends(get_current_org_id)
):
  try:
    return service.get_analytics_charts(current_org_id)
  except Exception as e:
    raise HTTPException(status_code=500, detail=str(e))