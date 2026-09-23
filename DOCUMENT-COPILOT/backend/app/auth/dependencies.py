"""Authentication dependencies verifying Supabase Auth JWTs.

Architecture & security contract:
- Supabase Auth is the identity source.
- FastAPI treats the browser's Supabase JWT as the request credential.
- Authorization: Bearer <token> is verified at the FastAPI boundary.
- Unauthenticated or malformed requests are rejected with 401 Unauthorized.
- user_id and email are derived from the verified Supabase user.
- A user-scoped Supabase client or DB user record can be cleanly injected into route handlers.
- The pilot is invite-only via Supabase Auth.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from supabase import Client

from app.database.models.user import User
from app.database.session import get_db
from app.database.supabase import get_anon_client, get_user_client

logger = structlog.get_logger(__name__)

# auto_error=True raises 401 Not authenticated if the Authorization header is absent.
bearer_scheme = HTTPBearer(auto_error=True)


@dataclass(frozen=True)
class AuthenticatedUser:
    """Verified user identity extracted from a valid Supabase Auth JWT."""

    id: uuid.UUID
    email: str
    access_token: str

    def get_client(self) -> Client:
        """Create a user-scoped Supabase client bound to this user's JWT."""
        return get_user_client(self.access_token)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> AuthenticatedUser:
    """FastAPI dependency to validate the bearer token and return the current user.

    Calls Supabase Auth to verify the JWT. Raises HTTP 401 if the token is invalid,
    expired, or malformed.
    """
    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        auth_client = get_anon_client().auth
        user_response = auth_client.get_user(token)
    except Exception as exc:
        logger.warning("auth_token_verification_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    if not user_response or not user_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found for token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = uuid.UUID(user_response.user.id)
    except ValueError as exc:
        logger.error("invalid_user_id_in_token", user_id=user_response.user.id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user identifier format",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    email = user_response.user.email or ""

    return AuthenticatedUser(
        id=user_id,
        email=email,
        access_token=token,
    )


def get_authenticated_user_client(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
) -> Client:
    """FastAPI dependency providing a user-scoped Supabase client."""
    return current_user.get_client()


def get_current_user_record(
    current_user: Annotated[AuthenticatedUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """FastAPI dependency ensuring the verified user is present in the Postgres users table.

    Mirrors Supabase auth.users into the local users table so foreign keys (such as
    chat_threads.user_id) resolve correctly.
    """
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        user = User(id=current_user.id, email=current_user.email)
        db.add(user)
        db.commit()
        db.refresh(user)
    elif user.email != current_user.email:
        user.email = current_user.email
        db.commit()
        db.refresh(user)
    return user
