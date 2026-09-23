"""Supabase client factories for user-scoped and service-role access.

Architecture contract:
- Server access uses either the user's bearer token for user-scoped operations
  or the service-role key for privileged writes.
- Service-role key is never exposed to the frontend and bypasses RLS on the database.
- User-scoped clients execute under the authenticated user's JWT so Postgres RLS
  policies are enforced.
"""

from functools import lru_cache

from supabase import (
    AsyncClient,
    AsyncClientOptions,
    Client,
    ClientOptions,
    create_async_client,
    create_client,
)

from app.config import settings


def _normalize_token(access_token: str) -> str:
    """Strip optional 'Bearer ' prefix and surrounding whitespace from token."""
    if not access_token:
        raise ValueError("access_token must not be empty")
    token = access_token.strip()
    if token.lower() == "bearer":
        raise ValueError("access_token must not be empty")
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    if not token:
        raise ValueError("access_token must not be empty")
    return token


def create_service_role_client() -> Client:
    """Create a new service-role Supabase client.

    Bypasses Row-Level Security (RLS). Use exclusively for trusted backend
    operations (e.g. data ingestion, administrative sync).
    """
    return create_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_service_role_key.get_secret_value(),
    )


@lru_cache(maxsize=1)
def get_service_role_client() -> Client:
    """Return a cached singleton service-role Supabase client."""
    return create_service_role_client()


# Alias for clarity with architecture documentation
get_admin_client = get_service_role_client


def create_anon_client() -> Client:
    """Create a new unauthenticated Supabase client using the anon key."""
    return create_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_anon_key.get_secret_value(),
    )


@lru_cache(maxsize=1)
def get_anon_client() -> Client:
    """Return a cached singleton anon Supabase client."""
    return create_anon_client()


def get_user_client(access_token: str) -> Client:
    """Create a user-scoped Supabase client bound to the user's JWT.

    Attaches the user's bearer token to all outgoing requests so that Supabase
    PostgREST and Storage enforce Row-Level Security (RLS) under that user's identity.
    """
    token = _normalize_token(access_token)
    client = create_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_anon_key.get_secret_value(),
        options=ClientOptions(
            headers={"Authorization": f"Bearer {token}"},
        ),
    )
    client.postgrest.auth(token)
    return client


# Alias for explicit user-scoped naming
get_user_scoped_client = get_user_client


async def create_async_service_role_client() -> AsyncClient:
    """Create an asynchronous service-role Supabase client."""
    return await create_async_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_service_role_key.get_secret_value(),
    )


async def get_async_user_client(access_token: str) -> AsyncClient:
    """Create an asynchronous user-scoped Supabase client bound to the user's JWT."""
    token = _normalize_token(access_token)
    client = await create_async_client(
        supabase_url=settings.supabase_url,
        supabase_key=settings.supabase_anon_key.get_secret_value(),
        options=AsyncClientOptions(
            headers={"Authorization": f"Bearer {token}"},
        ),
    )
    client.postgrest.auth(token)
    return client
