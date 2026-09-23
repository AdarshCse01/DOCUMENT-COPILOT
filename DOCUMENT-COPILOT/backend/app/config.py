import os
from pathlib import Path
from typing import Annotated, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent


def _require_nonempty(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be empty")
    return stripped


class Settings(BaseSettings):
    """Single source of truth for backend environment configuration."""

    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    supabase_url: str
    supabase_anon_key: SecretStr
    supabase_service_role_key: SecretStr
    database_url: SecretStr
    openai_api_key: SecretStr
    openai_embedding_model: str
    openai_embedding_dimensions: int
    openai_chat_model: str = "gpt-4o-mini"
    openai_agent_request_limit: int = 20
    openai_agent_temperature: float = 0.0
    allowed_origins: Annotated[list[str], NoDecode] = Field(min_length=1)

    @field_validator(
        "supabase_url",
        "supabase_anon_key",
        "supabase_service_role_key",
        "database_url",
        "openai_api_key",
        "openai_embedding_model",
        mode="before",
    )
    @classmethod
    def strip_required_str(cls, value: object) -> object:
        if isinstance(value, str):
            return _require_nonempty(value)
        if isinstance(value, SecretStr):
            _require_nonempty(value.get_secret_value())
            return value
        return value

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: object) -> object:
        if isinstance(value, str):
            origins = [origin.strip() for origin in value.split(",") if origin.strip()]
            if not origins:
                raise ValueError("ALLOWED_ORIGINS must contain at least one origin")
            return origins
        return value

    @property
    def sync_database_url(self) -> str:
        """Postgres connection string formatted for SQLAlchemy with psycopg 3."""
        url = self.database_url.get_secret_value()
        if url.startswith("postgres://"):
            return f"postgresql+psycopg://{url[len('postgres://') :]}"
        if url.startswith("postgresql://"):
            return f"postgresql+psycopg://{url[len('postgresql://') :]}"
        return url

    @model_validator(mode="after")
    def export_openai_api_key(self) -> Self:
        # The OpenAI SDK reads OPENAI_API_KEY from the process env.
        os.environ["OPENAI_API_KEY"] = self.openai_api_key.get_secret_value()
        return self


settings = Settings()
