from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.schemas import user as schemas
from app.repositories.user_repo import UserRepository

class UserService:
  def __init__(self, db: Session):
    self.repo = UserRepository(db)
    
  def list_users(self, org_id: UUID):
    return self.repo.list_all(org_id)

  def update_role(self, user_id: UUID, role_update: schemas.RoleUpdate, current_user_id: UUID, org_id: UUID):
    user = self.repo.get_by_id(user_id, org_id)
    if not user:
      raise HTTPException(status_code=404, detail="User not found")

    # Business Rule: Admins cannot demote/change themselves
    if user.id == current_user_id:
      raise HTTPException(status_code=400, detail="Admins cannot change their own role")
    
    user.role = role_update.role
    return self.repo.update(user)

  def delete_user(self, user_id: UUID, current_user_id: UUID, org_id: UUID):
    # Business Rule: Admins cannot delete themselves
    if user_id == current_user_id:
      raise HTTPException(status_code=400, detail="Admins cannot delete their own account")
    
    user = self.repo.get_by_id(user_id, org_id)
    if not user:
      raise HTTPException(status_code=404, detail="User not found")
    
    self.repo.delete(user)