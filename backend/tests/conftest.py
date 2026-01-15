# backend/tests/conftest.py
import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from main import app
from database import get_db, Base

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 1. Setup In-Memory Database
SQLALCHEMY_DATABASE_URL = "sqlite://"  # Memory only

engine = create_engine(
  SQLALCHEMY_DATABASE_URL,
  connect_args={"check_same_thread": False},
  poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 2. Override the Dependency
def override_get_db():
  try:
    db = TestingSessionLocal()
    yield db
  finally:
    db.close()

app.dependency_overrides[get_db] = override_get_db

# 3. Create Tables
@pytest.fixture(scope="module")
def client():
  Base.metadata.create_all(bind=engine)  # Create tables
  with TestClient(app) as c:
    yield c
  Base.metadata.drop_all(bind=engine)    # Cleanup