"""Command line helpers:  python -m app.cli create-user <username> "<Display Name>"  (asks for the password)."""
import getpass
import sys

from sqlalchemy import select

from .common import seed_options
from .config import BASE_DIR, settings
from .db import SessionLocal, migrate
from .models import User
from .security import hash_password


def _init():
    if settings.database_url.startswith("sqlite"):
        (BASE_DIR / "data").mkdir(exist_ok=True)
    migrate()


def create_user(username: str, display_name: str, password: str | None = None) -> None:
    _init()
    username = username.strip().lower()
    password = password or getpass.getpass("Password (min 8 characters): ")
    if len(password) < 8:
        sys.exit("Password must be at least 8 characters.")
    with SessionLocal() as db:
        seed_options(db)
        user = db.scalar(select(User).where(User.username == username))
        if user:
            user.password_hash, user.display_name = hash_password(password), display_name
            print(f"Updated user '{username}'.")
        else:
            db.add(User(username=username, display_name=display_name, password_hash=hash_password(password)))
            print(f"Created user '{username}'.")
        db.commit()


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) >= 3 and args[0] == "create-user":
        create_user(args[1], args[2], args[3] if len(args) > 3 else None)
    else:
        sys.exit('Usage: python -m app.cli create-user <username> "<Display Name>" [password]')
