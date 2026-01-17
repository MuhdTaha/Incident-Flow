# backend/tests/conftest.py

import os
import sys
import pytest
from sqlalchemy import create_engine, event
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

# 2. Database Fixture (Handles Transactions)
@pytest.fixture(scope="function")
def db():
  """
  Creates a fresh database session for a test.
  Uses a nested transaction so app commits don't persist to the actual DB connection.
  """
  connection = engine.connect()
  transaction = connection.begin()
  session = TestingSessionLocal(bind=connection)
  
  nested = connection.begin_nested()
  
  @event.listens_for(session, "after_transaction_end")
  def end_savepoint(session, transaction):
    if not nested.is_active:
      nested.start()

  def override_get_db():
    yield session
    
  app.dependency_overrides[get_db] = override_get_db
  yield session
  
  session.close()
  transaction.rollback()
  connection.close()
  
  del app.dependency_overrides[get_db]

# 3. Client Fixture
@pytest.fixture(scope="module")
def client():
  """
  TestClient that spans the whole module.
  Tables are created once, dropped once.
  """
  Base.metadata.create_all(bind=engine)  # Create tables
  # Run all the tests in the context of TestClient
  with TestClient(app) as c:
    yield c
  Base.metadata.drop_all(bind=engine)    # Cleanup after tests are done