"""
app/core/config.py

Centralized application configuration, loaded from environment variables
(.env in dev, real env vars in production). Nothing sensitive is hardcoded.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "Industry Grade AI"
    ENV: str = "development"
    DEBUG: bool = True

    # --- Database ---
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ind_grade_ai"

    # --- Auth / JWT ---
    JWT_SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_A_LONG_RANDOM_SECRET"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # --- Gemini AI ---
    GEMINI_API_KEY: str = ""
    GEMINI_EMBEDDING_MODEL: str = "models/gemini-embedding-001"
    GEMINI_GENERATION_MODEL: str = "models/gemini-3.8-flash"
    EMBEDDING_DIM: int = 768

    # --- Fetcher ---
    PLATFORM_FETCH_TIMEOUT_SECONDS: float = 12.0

    # --- CORS ---
    CORS_ALLOW_ORIGINS: list[str] = [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
