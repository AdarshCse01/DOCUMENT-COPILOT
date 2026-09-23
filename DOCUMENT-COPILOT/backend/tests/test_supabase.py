import pytest
from supabase import AsyncClient, Client

from app.config import settings
from app.database import (
    get_admin_client,
    get_anon_client,
    get_service_role_client,
    get_user_client,
    get_user_scoped_client,
)
from app.database.supabase import (
    create_anon_client,
    create_async_service_role_client,
    create_service_role_client,
    get_async_user_client,
)


def test_service_role_client_creation():
    client = get_service_role_client()
    assert isinstance(client, Client)
    assert client.supabase_key == settings.supabase_service_role_key.get_secret_value()
    assert str(client.supabase_url).rstrip("/") == settings.supabase_url.rstrip("/")

    # Cached singleton test
    client2 = get_service_role_client()
    assert client is client2

    # Alias check
    assert get_admin_client is get_service_role_client

    # Fresh client creation
    fresh_client = create_service_role_client()
    assert fresh_client is not client
    assert fresh_client.supabase_key == settings.supabase_service_role_key.get_secret_value()


def test_anon_client_creation():
    client = get_anon_client()
    assert isinstance(client, Client)
    assert client.supabase_key == settings.supabase_anon_key.get_secret_value()

    # Cached singleton test
    client2 = get_anon_client()
    assert client is client2

    fresh_client = create_anon_client()
    assert fresh_client is not client
    assert fresh_client.supabase_key == settings.supabase_anon_key.get_secret_value()


def test_user_scoped_client_creation():
    token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy.token"
    client = get_user_client(token)

    assert isinstance(client, Client)
    assert client.supabase_key == settings.supabase_anon_key.get_secret_value()
    assert client.options.headers.get("Authorization") == f"Bearer {token}"
    assert client.postgrest.headers.get("authorization") == f"Bearer {token}"

    # Alias check
    alias_client = get_user_scoped_client(f"Bearer {token}")
    assert alias_client.options.headers.get("Authorization") == f"Bearer {token}"
    assert alias_client.postgrest.headers.get("authorization") == f"Bearer {token}"


def test_user_scoped_client_validation():
    with pytest.raises(ValueError, match="access_token must not be empty"):
        get_user_client("")

    with pytest.raises(ValueError, match="access_token must not be empty"):
        get_user_client("   ")

    with pytest.raises(ValueError, match="access_token must not be empty"):
        get_user_client("Bearer   ")


@pytest.mark.anyio
async def test_async_service_role_client():
    client = await create_async_service_role_client()
    assert isinstance(client, AsyncClient)
    assert client.supabase_key == settings.supabase_service_role_key.get_secret_value()


@pytest.mark.anyio
async def test_async_user_client():
    token = "test_async_jwt"
    client = await get_async_user_client(f"Bearer {token}")
    assert isinstance(client, AsyncClient)
    assert client.supabase_key == settings.supabase_anon_key.get_secret_value()
    assert client.options.headers.get("Authorization") == f"Bearer {token}"
