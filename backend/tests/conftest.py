import os
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_tmp, 'test.db').as_posix()}"
os.environ["SECRET_KEY"] = "test-secret-test-secret-test-secret-123"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.cli import create_user  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        create_user("alice", "Alice", "password-one")
        create_user("bob", "Bob", "password-two")
        yield c


@pytest.fixture()
def authed(client):
    r = client.post("/api/auth/login", json={"username": "alice", "password": "password-one"})
    assert r.status_code == 200
    yield client
    client.post("/api/auth/logout")
