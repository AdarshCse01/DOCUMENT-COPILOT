import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.auth.dependencies import (
    AuthenticatedUser,
    get_authenticated_user_client,
    get_current_user_record,
)
from app.database.models.user import User as DBUser
from app.main import app

client = TestClient(app)


def test_protected_route_without_token():
    response = client.get("/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "Not authenticated"


def test_protected_route_with_invalid_token():
    with patch("app.auth.dependencies.get_anon_client") as mock_get_client:
        mock_auth = MagicMock()
        mock_auth.get_user.side_effect = Exception("invalid JWT signature")
        mock_get_client.return_value.auth = mock_auth

        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid or expired authentication token"


def test_protected_route_with_valid_token():
    user_id = uuid.uuid4()
    test_email = "analyst@driftwood.com"
    dummy_jwt = "valid.jwt.token"

    mock_supabase_user = MagicMock()
    mock_supabase_user.id = str(user_id)
    mock_supabase_user.email = test_email

    mock_response = MagicMock()
    mock_response.user = mock_supabase_user

    with patch("app.auth.dependencies.get_anon_client") as mock_get_client:
        mock_auth = MagicMock()
        mock_auth.get_user.return_value = mock_response
        mock_get_client.return_value.auth = mock_auth

        response = client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {dummy_jwt}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(user_id)
        assert data["email"] == test_email
        mock_auth.get_user.assert_called_once_with(dummy_jwt)


def test_authenticated_user_client_helper():
    user_id = uuid.uuid4()
    auth_user = AuthenticatedUser(
        id=user_id,
        email="analyst@driftwood.com",
        access_token="test_jwt_123",
    )
    with patch("app.auth.dependencies.get_user_client") as mock_get_user_client:
        client_instance = auth_user.get_client()
        mock_get_user_client.assert_called_once_with("test_jwt_123")
        assert client_instance == mock_get_user_client.return_value

    with patch("app.auth.dependencies.get_user_client") as mock_get_user_client:
        dep_client = get_authenticated_user_client(auth_user)
        mock_get_user_client.assert_called_once_with("test_jwt_123")
        assert dep_client == mock_get_user_client.return_value


def test_get_current_user_record_creates_and_updates():
    user_id = uuid.uuid4()
    auth_user = AuthenticatedUser(
        id=user_id,
        email="analyst@driftwood.com",
        access_token="test_jwt_123",
    )

    mock_db = MagicMock()
    # Case 1: User does not exist in DB
    mock_db.query.return_value.filter.return_value.first.return_value = None

    user_record = get_current_user_record(current_user=auth_user, db=mock_db)
    mock_db.add.assert_called_once()
    mock_db.commit.assert_called_once()
    assert user_record.id == user_id
    assert user_record.email == "analyst@driftwood.com"

    # Case 2: User exists with different email
    mock_db.reset_mock()
    existing_user = DBUser(id=user_id, email="old@driftwood.com")
    mock_db.query.return_value.filter.return_value.first.return_value = existing_user

    updated_record = get_current_user_record(current_user=auth_user, db=mock_db)
    assert updated_record.email == "analyst@driftwood.com"
    mock_db.commit.assert_called_once()
