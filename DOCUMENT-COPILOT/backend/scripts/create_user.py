"""
scripts/create_user.py — create a Supabase Auth user via the service-role API.

Usage:
    uv run python scripts/create_user.py analyst@driftwood.com S3cur3P@ssw0rd!

The user is created with email_confirm=True (no confirmation email needed).
Run this from the backend/ directory.
"""

from __future__ import annotations

import sys


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: uv run python scripts/create_user.py <email> <password>")
        sys.exit(1)

    email, password = sys.argv[1], sys.argv[2]

    # Import after arg validation so env errors surface cleanly
    from app.database.supabase import get_service_role_client

    client = get_service_role_client()

    response = client.auth.admin.create_user(
        {
            "email": email,
            "password": password,
            "email_confirm": True,  # skip confirmation email
        }
    )

    if response.user:
        print("✅  User created:")
        print(f"    id    : {response.user.id}")
        print(f"    email : {response.user.email}")
    else:
        print("❌  Failed to create user — no user returned.")
        sys.exit(1)


if __name__ == "__main__":
    main()
