from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    ENVIRONMENT: str = "production"
    
    # Database
    DATABASE_URL: str = "postgresql://auditos:auditos123@localhost:5432/auditos"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "supersecretkey1234567890abcdefghij"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # File storage
    UPLOAD_DIR: str = "./uploads"

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # AI
    OPENROUTER_API_KEY: str = ""

    # Connectors
    QUICKBOOKS_CLIENT_ID: str = ""
    QUICKBOOKS_CLIENT_SECRET: str = ""
    QUICKBOOKS_ENVIRONMENT: str = "sandbox"
    QUICKBOOKS_REDIRECT_URI: str = "http://localhost:8000/api/v1/connectors/quickbooks/callback"

    XERO_CLIENT_ID: str = ""
    XERO_CLIENT_SECRET: str = ""
    XERO_REDIRECT_URI: str = "http://localhost:8000/api/v1/connectors/xero/callback"

    # Zoho Books (India)
    ZOHO_CLIENT_ID: str = ""
    ZOHO_CLIENT_SECRET: str = ""
    ZOHO_REDIRECT_URI: str = "http://localhost:8000/api/v1/connectors/zoho/callback"
    ZOHO_ACCOUNTS_URL: str = "https://accounts.zoho.in"
    ZOHO_API_BASE: str = "https://www.zohoapis.in/books/v3"

    # Microsoft 365 / Azure AD Connector (IT Audit module)
    MS365_CLIENT_ID: str = ""
    MS365_CLIENT_SECRET: str = ""
    MS365_REDIRECT_URI: str = "http://localhost:8000/api/v1/connectors/microsoft365/callback"
    MS365_AUTHORITY: str = "https://login.microsoftonline.com/common"

    # Jira Finding Sync Connector (org-level, not per-engagement)
    JIRA_CLIENT_ID: str = ""
    JIRA_CLIENT_SECRET: str = ""
    JIRA_REDIRECT_URI: str = "http://localhost:8000/api/v1/connectors/jira/callback"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
