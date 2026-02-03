import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# ---------------------------------------------------------
# 1. Add the current directory to path so we can import 'models'
# ---------------------------------------------------------
sys.path.append(os.getcwd())

# 2. Import your Base and config
from database import Base  # Where your declarative_base is
import models              # Import models so Base finds them
from dotenv import load_dotenv

load_dotenv() # Load .env variables

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name) 

# ---------------------------------------------------------
# 3. Set the MetaData object for 'autogenerate' support
# ---------------------------------------------------------
target_metadata = Base.metadata

# ---------------------------------------------------------
# 4. Overwrite sqlalchemy.url with the Docker Environment Variable
# ---------------------------------------------------------
def get_url():
    url = os.getenv("DATABASE_URL", "")
    # Fix for SQLAlchemy if connection string uses 'postgres://' (deprecated)
    # instead of 'postgresql://'
    return url.replace("postgres://", "postgresql://")

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    
    # Inject the URL into the config object
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()
    
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()