from fastapi import APIRouter
from app.api.v1.endpoints import incidents, users, admin, attachments

api_router = APIRouter()

# Mount Incidents at /incidents
api_router.include_router(incidents.router, prefix="/incidents", tags=["incidents"])

# Mount Users at /users (contains /users and /users/organization logic if separated)
# Note: Your User router handles /users and /organization. 
# You might want to strip the prefixes inside users.py or adjust here.
# Assuming users.py has @router.get("/") for /users
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(users.router, prefix="/organization", tags=["organization"])

# Mount Admin at /admin
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])

# Mount Attachments at /incidents (because the paths start with /{incident_id}/attachments)
api_router.include_router(attachments.router, prefix="/incidents", tags=["attachments"])