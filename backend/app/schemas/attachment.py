from datetime import datetime
from pydantic import BaseModel
from uuid import UUID

# --- Attachment Upload Schemas ---
class AttachmentSignRequest(BaseModel):
  file_name: str
  file_type: str

class AttachmentCompleteRequest(BaseModel):
  file_name: str
  file_key: str

class AttachmentRead(BaseModel):
  id: UUID
  file_name: str
  file_url: str
  uploaded_by: str
  created_at: datetime
  
  class Config:
    from_attributes = True