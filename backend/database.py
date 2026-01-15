import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# 1. Load environment variables from .env file
load_dotenv()

# 2. Get the Database URL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

if not DATABASE_URL:
  raise ValueError("DATABASE_URL is not set in the environment variables.")

# 3. Create the Engine
connect_args = {}
if "sqlite" in DATABASE_URL:
  connect_args = {"check_same_thread": False}
elif "supabase.co" in DATABASE_URL:
  connect_args = {"sslmode": "require"}
else:
  # Local Docker Postgres
  connect_args = {"sslmode": "disable"}

engine = create_engine(
  DATABASE_URL,
  connect_args=connect_args,
  pool_pre_ping=True,
  pool_recycle=300 
)

# 4. Create the Session Local class
# Each request will create a new instance of this class.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 5. Create the Base class
# All your models in models.py will inherit from this.
Base = declarative_base()

# 6. Dependency for FastAPI
# This yields a database session for a request and closes it immediately after.
def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()