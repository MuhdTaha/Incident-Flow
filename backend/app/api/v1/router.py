from fastapi import APIRouter
from app.api.v1.endpoints import incidents, users, admin, attachments, organization

api_router = APIRouter()

# Mount Incidents at /incidents
api_router.include_router(incidents.router, prefix="/incidents", tags=["incidents"])

# Mount Users at /users
api_router.include_router(users.router, prefix="/users", tags=["users"])

# Mount Organizations at /orgs
api_router.include_router(organization.router, prefix="/orgs", tags=["organization"])

# Mount Admin at /admin
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# Mount Attachments at /incidents (because the paths start with /{incident_id}/attachments)
api_router.include_router(attachments.router, prefix="/incidents", tags=["attachments"])