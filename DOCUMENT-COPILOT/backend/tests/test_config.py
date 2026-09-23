import os

import pytest
from pydantic import ValidationError

from app.config import Settings


def _valid_config_kwargs() -> dict[str, object]:
    return {
        "supabase_url": "https://test.supabase.co",
        "supabase_anon_key": "anon-key-123",
        "supabase_service_role_key": "service-role-key-123",
        "database_url": "postgresql://postgres:secret@localhost:5432/postgres",
        "openai_api_key": "sk-test-key-abc",
        "openai_embedding_model": "text-embedding-3-small",
        "openai_embedding_dimensions": 1536,
        "allowed_origins": "http://localhost:5173, http://127.0.0.1:5173",
    }


def test_settings_valid_initialization():
    cfg = Settings(_env_file=None, **_valid_config_kwargs())
    assert cfg.supabase_url == "https://test.supabase.co"
    assert cfg.supabase_anon_key.get_secret_value() == "anon-key-123"
    assert cfg.supabase_service_role_key.get_secret_value() == "service-role-key-123"
    assert cfg.openai_api_key.get_secret_value() == "sk-test-key-abc"
    assert cfg.openai_embedding_model == "text-embedding-3-small"
    assert cfg.openai_embedding_dimensions == 1536
    assert cfg.allowed_origins == ["http://localhost:5173", "http://127.0.0.1:5173"]


def test_settings_exports_openai_api_key_to_env():
    Settings(_env_file=None, **_valid_config_kwargs())
    assert os.environ.get("OPENAI_API_KEY") == "sk-test-key-abc"


def test_settings_sync_database_url_conversion():
    cfg1 = Settings(_env_file=None, **_valid_config_kwargs())
    assert (
        cfg1.sync_database_url
        == "postgresql+psycopg://postgres:secret@localhost:5432/postgres"
    )

    kwargs2 = _valid_config_kwargs()
    kwargs2["database_url"] = "postgres://postgres:secret@localhost:5432/postgres"
    cfg2 = Settings(_env_file=None, **kwargs2)
    assert (
        cfg2.sync_database_url
        == "postgresql+psycopg://postgres:secret@localhost:5432/postgres"
    )


def test_settings_fails_fast_on_missing_required():
    kwargs = _valid_config_kwargs()
    del kwargs["supabase_url"]
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **kwargs)


def test_settings_fails_fast_on_empty_string():
    kwargs = _valid_config_kwargs()
    kwargs["supabase_url"] = "   "
    with pytest.raises(ValidationError, match="must not be empty"):
        Settings(_env_file=None, **kwargs)


def test_settings_fails_fast_on_empty_secret():
    kwargs = _valid_config_kwargs()
    kwargs["openai_api_key"] = "   "
    with pytest.raises(ValidationError, match="must not be empty"):
        Settings(_env_file=None, **kwargs)


def test_settings_allowed_origins_empty_fails():
    kwargs = _valid_config_kwargs()
    kwargs["allowed_origins"] = "   ,   "
    with pytest.raises(
        ValidationError, match="ALLOWED_ORIGINS must contain at least one origin"
    ):
        Settings(_env_file=None, **kwargs)
