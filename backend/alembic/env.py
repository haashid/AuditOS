import logging
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Import all models so Alembic can detect them
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.database import Base
from core.config import settings
# Import all model modules to register them
from models.user import User, Organization
from models.engagement import Engagement, Transaction
from models.document import Document
from models.finding import Finding
from models.workpaper import Workpaper
from models.fraud_alert import FraudAlert
from models.portal_user import PortalUser
from models.regulation import Regulation
from models.risk_library import RiskLibraryItem
from models.connector import ConnectorToken

# this is the Alembic Config object
config = context.config

# Set the sqlalchemy.url dynamically from settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
