import os
import tempfile

# Тесты не должны ходить во внешние сервисы и тратить лимиты, даже если в .env настроены
# реальные провайдеры. Переменные окружения приоритетнее .env; ставим их до импорта приложения.
for _name in ("IMAGE_PROVIDER", "DESCRIPTION_PROVIDER", "TTS_PROVIDER"):
    os.environ[_name] = "stub"
os.environ["DATABASE_PATH"] = os.path.join(tempfile.mkdtemp(prefix="audiocanvas-test-"), "test.db")
for _name in ("IMAGE_API_KEY", "VISION_API_KEY", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"):
    os.environ[_name] = ""

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core import db, state  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def no_retry_delays(monkeypatch):
    from app.providers import http

    monkeypatch.setattr(http, "_sleep", lambda _s: None)


@pytest.fixture(autouse=True)
def clean_state():
    db.init_db()
    state.reset_state()
    db.reset_db()
    yield
    state.reset_state()
    db.reset_db()


@pytest.fixture
def client():
    return TestClient(app)
